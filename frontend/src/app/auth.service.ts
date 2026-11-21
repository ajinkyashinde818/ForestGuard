import { HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
export type ForestGuardRole = 'ADMIN' | 'FOREST_OFFICER' | 'OFFICER' | 'ANALYST' | 'VIEWER' | 'DEVICE';
export interface SessionUser { id:string; email:string; name:string; role:ForestGuardRole; }
interface LoginResponse { accessToken:string; user:SessionUser; }
export const API='/api';
export const authInterceptor:HttpInterceptorFn=(req,next)=>{const token=localStorage.getItem('fg_token');return next(token?req.clone({setHeaders:{Authorization:`Bearer ${token}`}}):req);};
@Injectable({providedIn:'root'}) export class AuthService { private http=inject(HttpClient);private router=inject(Router); login(email:string,password:string){return this.http.post<LoginResponse>(`${API}/auth/login`,{email,password}).pipe(tap(r=>{localStorage.setItem('fg_token',r.accessToken);localStorage.setItem('fg_user',JSON.stringify(r.user));}));} logout(){localStorage.removeItem('fg_token');localStorage.removeItem('fg_user');void this.router.navigate(['/login']);} get authenticated(){return !!localStorage.getItem('fg_token');} get user():SessionUser|null{try{return JSON.parse(localStorage.getItem('fg_user')??'null') as SessionUser|null;}catch{return null;}} get isAdmin(){return this.user?.role==='ADMIN';}}
