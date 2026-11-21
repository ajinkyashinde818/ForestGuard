import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { API, AuthService } from './auth.service';
import { FirebaseDevicesPanelComponent } from './firebase/firebase-live-panels.component';

type DeviceState='ONLINE'|'OFFLINE'|'WARNING'|'INACTIVE'|'DISABLED';
interface MonitoringDevice { id:string;deviceCode:string;name:string;status:DeviceState;active:boolean;battery:number|null;latitude:number|null;longitude:number|null;networkStatus:string|null;monitoringStatus:string;appVersion:string|null;firmwareVersion:string|null;lastSeen:string|null;isDemo:boolean; }

@Component({standalone:true,imports:[CommonModule,FormsModule,FirebaseDevicesPanelComponent],template:`
  <section class="welcome"><div><h2>Device fleet</h2><p>Registered monitoring nodes and their most recent reported health.</p></div></section>
  <article class="panel"><div class="panel-head"><div><h3>Monitoring devices</h3><p>Location and telemetry appear only when reported by a device.</p></div><input class="search" name="search" [(ngModel)]="search" placeholder="Search name or device ID"></div>
    <div class="table"><div class="row device-row device-head"><span>DEVICE</span><span>STATUS</span><span>BATTERY</span><span>LOCATION</span><span>LAST HEARTBEAT</span><span>APP / NETWORK</span><span *ngIf="auth.isAdmin">ADMIN</span></div>
      <div class="row device-row" *ngFor="let device of filtered"><span><b>{{device.name}}</b><small>{{device.deviceCode}} <em *ngIf="device.isDemo">· DEMO</em></small></span><span><i class="status" [class.urgent]="device.status==='OFFLINE'"></i>{{device.status}}</span><span>{{device.battery===null?'—':device.battery+'%'}}</span><span>{{device.latitude===null||device.longitude===null?'Not reported':(device.latitude|number:'1.3-5')+', '+(device.longitude|number:'1.3-5')}}</span><span>{{device.lastSeen?(device.lastSeen|date:'medium'):'Never'}}</span><span>{{device.appVersion||'—'}}<small>{{device.networkStatus||'Network unknown'}}</small></span><span *ngIf="auth.isAdmin"><button class="subtle-button" (click)="toggle(device)">{{device.status==='DISABLED'?'Enable':'Disable'}}</button></span></div>
      <div class="empty" *ngIf="!filtered.length">No devices match this search.</div>
    </div><p class="error" *ngIf="error">{{error}}</p>
  </article><fg-firebase-devices></fg-firebase-devices>`,styles:[`.panel-head{gap:16px}.search{max-width:260px;padding:9px 12px;border:1px solid #dbe2d9;border-radius:8px}.device-row{grid-template-columns:1.2fr .8fr .6fr 1.2fr 1.2fr 1fr .6fr}.device-head{font-size:10px;font-weight:700;letter-spacing:.07em}.device-row small{display:block;margin-top:4px;color:#819087}.device-row em{font-style:normal;color:#976b22;font-weight:700}.subtle-button{border:1px solid #d7dfd7;border-radius:7px;background:white;color:#355540;padding:7px 10px;cursor:pointer}@media(max-width:1000px){.device-row{grid-template-columns:1fr .8fr .6fr 1.2fr}.device-row span:nth-child(n+5){display:none}}` ]})
export class DevicesComponent {
  private readonly http=inject(HttpClient);
  readonly auth=inject(AuthService);
  devices:MonitoringDevice[]=[];search='';error='';
  get filtered(){const term=this.search.trim().toLowerCase();return this.devices.filter(d=>!term||d.name.toLowerCase().includes(term)||d.deviceCode.toLowerCase().includes(term));}
  constructor(){this.load();}
  load(){this.http.get<MonitoringDevice[]>(`${API}/devices`).subscribe({next:devices=>this.devices=devices,error:()=>this.error='Unable to load devices. Check your account access and API connection.'});}
  toggle(device:MonitoringDevice){const status=device.active?'DISABLED':'OFFLINE';this.http.patch<Pick<MonitoringDevice,'id'|'status'|'active'>>(`${API}/devices/${device.id}/status`,{status}).subscribe({next:updated=>this.devices=this.devices.map(d=>d.id===updated.id?{...d,status:updated.status,active:updated.active}:d),error:err=>this.error=err.error?.message??'Unable to update device.'});}
}
