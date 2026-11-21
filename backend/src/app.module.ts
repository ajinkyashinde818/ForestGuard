import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { AuthController, DevicesController, EventsController, DashboardController, HealthController, AlertsController, UsersController } from './controllers';
import { AuthService, JwtGuard, RoleGuard, DeviceGuard } from './auth';
import { LiveGateway } from './gateway';
import { AudioController } from './audio.controller';
import { AudioStorageService } from './audio-storage.service';
import { GeminiService } from './gemini.service';
import { DevicePresenceService } from './device-presence.service';
@Module({ imports:[ConfigModule.forRoot({isGlobal:true}),JwtModule.registerAsync({global:true,inject:[ConfigService],useFactory:(c:ConfigService)=>({secret:c.getOrThrow('JWT_SECRET'),signOptions:{expiresIn:c.get('JWT_EXPIRES_IN','15m')}})})],controllers:[AuthController,DevicesController,EventsController,AudioController,DashboardController,HealthController,AlertsController,UsersController],providers:[PrismaService,AuthService,JwtGuard,RoleGuard,DeviceGuard,AudioStorageService,GeminiService,DevicePresenceService,LiveGateway] })
export class AppModule {}
