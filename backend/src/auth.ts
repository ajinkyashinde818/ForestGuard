import { CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { RoleName } from '@prisma/client';
import { PrismaService } from './prisma.service';
import * as bcrypt from 'bcryptjs';

export const Roles = (...roles: RoleName[]) => SetMetadata('roles', roles);
export const MONITORING_READ_ROLES: RoleName[] = [
  RoleName.ADMIN,
  RoleName.FOREST_OFFICER,
  RoleName.OFFICER,
  RoleName.ANALYST,
  RoleName.VIEWER,
];
export const EVENT_REVIEW_ROLES: RoleName[] = [
  RoleName.ADMIN,
  RoleName.FOREST_OFFICER,
  RoleName.OFFICER,
  RoleName.ANALYST,
];
export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user);
export const CurrentDevice = createParamDecorator((_d: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().device);

export interface AuthenticatedUser {
  sub: string;
  role: RoleName;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user?.active || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      accessToken: this.jwt.sign({
        sub: user.id,
        role: user.role,
        email: user.email,
      }),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}

@Injectable()
export class JwtGuard implements CanActivate {
 constructor(private jwt: JwtService) {}
 canActivate(ctx: ExecutionContext) { const req=ctx.switchToHttp().getRequest(); const token=req.headers.authorization?.replace(/^Bearer\s+/i,''); if(!token) throw new UnauthorizedException(); try { req.user=this.jwt.verify(token); return true; } catch { throw new UnauthorizedException(); } }
}
@Injectable()
export class RoleGuard implements CanActivate {
 constructor(private reflector: Reflector) {}
 canActivate(ctx: ExecutionContext) { const roles=this.reflector.getAllAndOverride<RoleName[]>('roles',[ctx.getHandler(),ctx.getClass()]); if(!roles?.length) return true; const user=ctx.switchToHttp().getRequest().user; if(!user||!roles.includes(user.role)) throw new ForbiddenException(); return true; }
}
@Injectable()
export class DeviceGuard implements CanActivate {
 constructor(private db:PrismaService) {}
 async canActivate(ctx:ExecutionContext) { const req=ctx.switchToHttp().getRequest(); const code=req.headers['x-device-id']; const token=req.headers['x-device-token']; if(typeof code!=='string'||typeof token!=='string') throw new UnauthorizedException('Device credentials required'); const d=await this.db.device.findUnique({where:{deviceCode:code}}); if(!d?.active||!await bcrypt.compare(token,d.credentialHash)) throw new UnauthorizedException('Invalid device credentials'); req.device=d; return true; }
}
