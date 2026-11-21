import { DeviceStatus } from '@prisma/client';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { LiveGateway } from './gateway';

@Injectable()
export class DevicePresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DevicePresenceService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    private readonly live: LiveGateway,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.markStaleDevicesOffline().catch(() => {
        this.logger.warn('Device presence sweep failed');
      });
    }, 30_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async markStaleDevicesOffline(): Promise<void> {
    const timeoutSeconds = Math.max(
      30,
      Number(this.config.get('HEARTBEAT_TIMEOUT_SECONDS', '120')) || 120,
    );
    const staleBefore = new Date(Date.now() - timeoutSeconds * 1000);
    const staleDevices = await this.db.device.findMany({
      where: {
        active: true,
        status: { in: [DeviceStatus.ONLINE, DeviceStatus.WARNING] },
        lastSeen: { lt: staleBefore },
      },
      select: { id: true, deviceCode: true },
    });

    for (const device of staleDevices) {
      const changed = await this.db.device.updateMany({
        where: {
          id: device.id,
          active: true,
          status: { in: [DeviceStatus.ONLINE, DeviceStatus.WARNING] },
          lastSeen: { lt: staleBefore },
        },
        data: { status: DeviceStatus.OFFLINE },
      });
      if (changed.count > 0) {
        this.live.publish('device.offline', {
          id: device.id,
          deviceCode: device.deviceCode,
          status: DeviceStatus.OFFLINE,
        });
      }
    }
  }
}
