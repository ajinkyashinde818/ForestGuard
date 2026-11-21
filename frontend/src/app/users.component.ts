import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { API, AuthService, ForestGuardRole } from './auth.service';

interface ManagedUser { id:string; email:string; name:string; role:Exclude<ForestGuardRole,'DEVICE'>; active:boolean; createdAt:string; }
type HumanRole=Exclude<ForestGuardRole,'DEVICE'>;

@Component({
  standalone:true,
  imports:[CommonModule,FormsModule],
  template:`
    <section class="welcome"><div><h2>User management</h2><p>Create and manage dashboard accounts and their access roles.</p></div></section>
    <article class="panel user-form">
      <div class="panel-head"><div><h3>Add user</h3><p>Passwords must contain at least 12 characters.</p></div></div>
      <form (ngSubmit)="create()">
        <label>Name<input name="name" [(ngModel)]="draft.name" required minlength="2" maxlength="120"></label>
        <label>Email<input name="email" type="email" [(ngModel)]="draft.email" required></label>
        <label>Initial password<input name="password" type="password" [(ngModel)]="draft.password" required minlength="12"></label>
        <label>Role<select name="role" [(ngModel)]="draft.role"><option *ngFor="let role of roles" [value]="role">{{role}}</option></select></label>
        <button class="primary" [disabled]="saving">{{saving?'Creating…':'Create account'}}</button>
      </form>
      <p class="error" *ngIf="error">{{error}}</p><p class="success" *ngIf="notice">{{notice}}</p>
    </article>
    <article class="panel"><div class="panel-head"><div><h3>Accounts</h3><p>{{users.length}} user accounts</p></div></div>
      <div class="table"><div class="row user-row user-head"><span>NAME</span><span>EMAIL</span><span>ROLE</span><span>ACCESS</span><span>ACTION</span></div>
        <div class="row user-row" *ngFor="let user of users"><span><b>{{user.name}}</b></span><span>{{user.email}}</span><span>{{user.role}}</span><span>{{user.active?'Active':'Disabled'}}</span><span><button type="button" class="subtle-button" [disabled]="user.id===currentId" (click)="setActive(user,!user.active)">{{user.active?'Disable':'Enable'}}</button></span></div>
        <div class="empty" *ngIf="!users.length">No users returned by the API.</div>
      </div>
    </article>`,
  styles:[`.user-form{margin-bottom:18px}.user-form form{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;align-items:end;padding:18px}.user-form label{display:grid;gap:7px;font-size:12px;color:#6f7d72}.user-form input,.user-form select{width:100%;padding:10px 12px;border:1px solid #dbe2d9;border-radius:8px;background:white;color:#233229}.user-row{grid-template-columns:1.1fr 1.5fr 1fr .8fr .8fr}.user-head{font-size:10px;font-weight:700;letter-spacing:.08em}.subtle-button{border:1px solid #d7dfd7;border-radius:7px;background:white;color:#355540;padding:7px 10px;cursor:pointer}.success{color:#2e7545;padding:0 18px 12px}.error{padding:0 18px 12px}@media(max-width:760px){.user-row{grid-template-columns:1fr 1.4fr 1fr}.user-head span:nth-child(n+4),.user-row span:nth-child(n+4){display:none}}`],
})
export class UsersComponent {
  private readonly http=inject(HttpClient);
  private readonly auth=inject(AuthService);
  readonly roles:HumanRole[]=['ADMIN','FOREST_OFFICER','OFFICER','ANALYST','VIEWER'];
  users:ManagedUser[]=[];
  currentId=this.auth.user?.id;
  draft:{name:string;email:string;password:string;role:HumanRole}={name:'',email:'',password:'',role:'OFFICER'};
  saving=false;error='';notice='';
  constructor(){this.load();}
  load(){this.http.get<ManagedUser[]>(`${API}/users`).subscribe({next:users=>this.users=users,error:()=>this.error='Unable to load user accounts. Check your admin access.'});}
  create(){this.error='';this.notice='';this.saving=true;this.http.post<ManagedUser>(`${API}/users`,this.draft).subscribe({next:user=>{this.users=[user,...this.users];this.draft={name:'',email:'',password:'',role:'OFFICER'};this.saving=false;this.notice='Account created.';},error:err=>{this.saving=false;this.error=err.error?.message??'Unable to create account.';}});}
  setActive(user:ManagedUser,active:boolean){this.error='';this.http.patch<ManagedUser>(`${API}/users/${user.id}`,{active}).subscribe({next:updated=>this.users=this.users.map(item=>item.id===updated.id?updated:item),error:err=>this.error=err.error?.message??'Unable to update account.'});}
}
