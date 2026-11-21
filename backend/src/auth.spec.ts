import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService, JwtGuard, RoleGuard } from './auth';
import { PrismaService } from './prisma.service';
import * as bcrypt from 'bcryptjs';

describe('authentication and access guards',()=>{
  const db:any={user:{findUnique:jest.fn()}};
  let auth:AuthService;let jwt:JwtService;
  beforeEach(async()=>{jest.clearAllMocks();const module=await Test.createTestingModule({providers:[AuthService,{provide:PrismaService,useValue:db},{provide:JwtService,useValue:new JwtService({secret:'unit-test-signing-secret'})}]}).compile();auth=module.get(AuthService);jwt=module.get(JwtService);});
  it('issues a JWT for a valid active user',async()=>{const hash=await bcrypt.hash('Password!123',4);db.user.findUnique.mockResolvedValue({id:'user-1',email:'officer@example.test',name:'Officer',role:'FOREST_OFFICER',active:true,passwordHash:hash});const result=await auth.login('OFFICER@example.test','Password!123');expect(jwt.verify(result.accessToken).sub).toBe('user-1');expect(result.user.role).toBe('FOREST_OFFICER');});
  it('rejects unknown users and incorrect passwords',async()=>{db.user.findUnique.mockResolvedValue(null);await expect(auth.login('missing@example.test','Password!123')).rejects.toBeInstanceOf(UnauthorizedException);db.user.findUnique.mockResolvedValue({active:true,passwordHash:await bcrypt.hash('correct',4)});await expect(auth.login('user@example.test','incorrect')).rejects.toBeInstanceOf(UnauthorizedException);});
  it('rejects expired or malformed bearer tokens',()=>{const guard=new JwtGuard(jwt);const ctx:any={switchToHttp:()=>({getRequest:()=>({headers:{authorization:'Bearer malformed'}})})};expect(()=>guard.canActivate(ctx)).toThrow(UnauthorizedException);});
  it('blocks users without an allowed role',()=>{const reflector={getAllAndOverride:()=>['ADMIN']} as unknown as Reflector;const guard=new RoleGuard(reflector);const ctx:any={getHandler:()=>({}),getClass:()=>({}),switchToHttp:()=>({getRequest:()=>({user:{role:'FOREST_OFFICER'}})})};expect(()=>guard.canActivate(ctx)).toThrow(ForbiddenException);});
});
