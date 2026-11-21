import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { API, AuthService } from './auth.service';
import { FirebaseAlertsPanelComponent } from './firebase/firebase-live-panels.component';

interface AlertRecord { id:string;message:string;priority:'LOW'|'MEDIUM'|'HIGH'|'CRITICAL';status:'OPEN'|'ACKNOWLEDGED';createdAt:string;acknowledgedAt:string|null;event:{id:string;type:string;occurredAt:string;device:{deviceCode:string;name:string}}; }
@Component({standalone:true,imports:[CommonModule,FirebaseAlertsPanelComponent],template:`
  <section class="welcome"><div><h2>Alerts</h2><p>Review possible environmental sounds and device issues. Alerts are not proof of illegal activity.</p></div></section>
  <article class="panel"><div class="panel-head"><div><h3>Alert queue</h3><p>{{openCount}} open alerts · {{alerts.length}} total</p></div></div>
    <div class="table"><div class="row alert-row alert-head"><span>ALERT</span><span>DEVICE / EVENT</span><span>PRIORITY</span><span>CREATED</span><span>STATUS</span><span>ACTION</span></div>
      <div class="row alert-row" *ngFor="let alert of alerts"><span><a [href]="'/events/'+alert.event.id"><b>{{alert.message}}</b></a><small>Human verification required</small></span><span>{{alert.event.device.name}}<small>{{alert.event.device.deviceCode}} · {{alert.event.type}}</small></span><span>{{alert.priority}}</span><span>{{alert.createdAt|date:'medium'}}</span><span>{{alert.status}}</span><span><button class="subtle-button" *ngIf="alert.status==='OPEN'&&canReview" (click)="acknowledge(alert)">Acknowledge</button><span *ngIf="alert.status==='ACKNOWLEDGED'">{{alert.acknowledgedAt|date:'short'}}</span></span></div>
      <div class="empty" *ngIf="!alerts.length">No alerts currently available.</div>
    </div><p class="error" *ngIf="error">{{error}}</p>
  </article><fg-firebase-alerts></fg-firebase-alerts>`,styles:[`.alert-row{grid-template-columns:1.4fr 1.2fr .7fr 1fr .8fr .9fr}.alert-head{font-size:10px;font-weight:700;letter-spacing:.07em}.alert-row small{display:block;margin-top:4px;color:#819087}.subtle-button{border:1px solid #d7dfd7;border-radius:7px;background:white;color:#355540;padding:7px 10px;cursor:pointer}@media(max-width:850px){.alert-row{grid-template-columns:1.5fr 1.1fr .7fr}.alert-row span:nth-child(n+4){display:none}}` ]})
export class AlertsComponent {
  private readonly http=inject(HttpClient);
  readonly auth=inject(AuthService);
  alerts:AlertRecord[]=[];error='';
  get canReview(){return ['ADMIN','FOREST_OFFICER','OFFICER','ANALYST'].includes(this.auth.user?.role??'');}
  get openCount(){return this.alerts.filter(alert=>alert.status==='OPEN').length;}
  constructor(){this.load();}
  load(){this.http.get<AlertRecord[]>(`${API}/alerts`).subscribe({next:alerts=>this.alerts=alerts,error:()=>this.error='Unable to load alerts. Check your account access.'});}
  acknowledge(alert:AlertRecord){this.http.patch<AlertRecord>(`${API}/alerts/${alert.id}/acknowledge`,{}).subscribe({next:updated=>this.alerts=this.alerts.map(item=>item.id===updated.id?updated:item),error:err=>this.error=err.error?.message??'Unable to acknowledge this alert.'});}
}
