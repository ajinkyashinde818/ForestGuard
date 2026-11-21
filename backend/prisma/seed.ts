import { EventStatus, EventType, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_DEMO_SEED !== 'true'
  ) {
    throw new Error(
      'Refusing demo seed in production. Set ALLOW_DEMO_SEED=true explicitly.',
    );
  }

  const passwordHash = await bcrypt.hash('DemoAdmin!ChangeMe', 12);
  const officerHash = await bcrypt.hash('DemoOfficer!ChangeMe', 12);

  const admin = await db.user.upsert({
    where: { email: 'admin@forestguard.demo' },
    update: {},
    create: {
      email: 'admin@forestguard.demo',
      name: 'DEMO Administrator',
      passwordHash,
      role: 'ADMIN',
    },
  });

  const officer = await db.user.upsert({
    where: { email: 'officer@forestguard.demo' },
    update: {},
    create: {
      email: 'officer@forestguard.demo',
      name: 'DEMO Forest Officer',
      passwordHash: officerHash,
      role: 'FOREST_OFFICER',
    },
  });

  const device = await db.device.upsert({
    where: { deviceCode: 'FG-DEMO-001' },
    update: {},
    create: {
      deviceCode: 'FG-DEMO-001',
      name: 'DEMO Ridge Node',
      credentialHash: await bcrypt.hash('demo-device-token-not-for-use', 12),
      status: 'ONLINE',
      battery: 86,
      latitude: 18.5204,
      longitude: 73.8567,
      networkStatus: 'CONNECTED',
      monitoringStatus: 'ACTIVE',
      lastSeen: new Date(),
      isDemo: true,
    },
  });

  await db.deviceAssignment.createMany({
    data: [
      {
        deviceId: device.id,
        userId: officer.id,
        zoneName: 'DEMO Zone',
      },
    ],
    skipDuplicates: true,
  });

  const existingDemoEvent = await db.event.findFirst({
    where: { deviceId: device.id, isDemo: true },
  });

  if (!existingDemoEvent) {
    await db.event.create({
      data: {
        deviceId: device.id,
        type: EventType.CHAINSAW,
        status: EventStatus.NEW,
        confidence: 0.81,
        description:
          'DEMO ONLY: simulated chainsaw-like sound; requires human review.',
        latitude: device.latitude,
        longitude: device.longitude,
        isDemo: true,
        alerts: {
          create: {
            message:
              'DEMO ONLY: simulated possible mechanical sound; verify before action.',
            priority: 'HIGH',
          },
        },
      },
    });
  }

  console.log(`Demo seed ready for ${admin.email} and ${officer.email}`);
}

main().finally(() => db.$disconnect());
