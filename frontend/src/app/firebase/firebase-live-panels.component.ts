import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FirestoreError } from 'firebase/firestore';
import { FirebaseAlert, FirebaseDataService, FirebaseDevice, FirebaseEvent } from './firebase-data.service';

@Component({
  selector: 'fg-firebase-devices',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="panel live-panel"><div class="panel-head"><div><h3>Android devices · Firebase</h3><p>Realtime documents from <code>devices</code></p></div><span class="connection" [class.connected]="connected">{{connected?'LISTENING':'CONNECTING'}}</span></div>
      <p class="error" *ngIf="error">Unable to read Firebase devices: {{error.message}}</p>
      <div class="table"><div class="row live-device-head"><span>DEVICE ID</span><span>STATUS</span><span>BATTERY / CHARGING</span><span>NETWORK</span><span>MONITORING</span><span>LAST HEARTBEAT</span><span>LOCATION</span></div>
        <div class="row live-device-row" *ngFor="let device of devices"><span><b>{{device.name||device.id}}</b><small>{{device.id}}</small></span><span>{{device.status||'Not reported'}}</span><span>{{device.battery===null?'Not reported':device.battery+'%'}}<small>Charging: {{device.charging===null?'Not reported':device.charging}}</small></span><span>{{device.network||'Not reported'}}</span><span>{{device.monitoringStatus||'Not reported'}}</span><span>{{device.lastHeartbeat?(device.lastHeartbeat|date:'medium'):'Not reported'}}</span><span>{{coordinates(device)}}</span></div>
        <div class="empty" *ngIf="connected&&!devices.length">No Firebase devices found.</div>
      </div>
    </article>`,
  styles: [`.live-panel{margin-top:16px;overflow-x:auto}.live-device-head,.live-device-row{min-width:900px;grid-template-columns:1.1fr .7fr .9fr .7fr .8fr 1.1fr .9fr}.live-device-row small{display:block;color:#87928a;margin-top:4px}.connection{font-size:9px;color:#78857c}.connection.connected{color:#367448}.live-panel code{font-size:11px}`],
})
export class FirebaseDevicesPanelComponent implements OnInit, OnDestroy {
  devices: FirebaseDevice[] = [];
  connected = false;
  error: FirestoreError | null = null;
  private stop?: () => void;
  constructor(private readonly firebase: FirebaseDataService) {}
  ngOnInit(): void { this.stop = this.firebase.watchDevices((items,fromCache) => { this.devices=items; this.connected=!fromCache; this.error=null; }, (error) => { this.error=error; this.connected=false; }); }
  ngOnDestroy(): void { this.stop?.(); }
  coordinates(device: FirebaseDevice): string { return device.latitude!==null&&device.longitude!==null?`${device.latitude}, ${device.longitude}`:'Not reported'; }
}

@Component({
  selector: 'fg-firebase-events',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <article class="panel live-panel"><div class="panel-head"><div><h3>Android events · Firebase</h3><p>Realtime documents from <code>events</code></p></div><span class="connection" [class.connected]="connected">{{connected?'LISTENING':'CONNECTING'}}</span></div>
      <p class="error" *ngIf="error">Unable to read Firebase events: {{error.message}}</p>
      <div class="table"><div class="row live-event-head"><span>EVENT</span><span>DEVICE</span><span>LOCATION</span><span>DETECTED</span><span>EVIDENCE</span></div>
        <div class="row live-event-row" *ngFor="let event of events"><span><a [routerLink]="['/events',event.id]"><b>{{event.type||'Unclassified sound'}}</b></a><small>{{event.id}}</small></span><span>{{event.deviceId||'Not reported'}}</span><span>{{coordinates(event)}}</span><span>{{event.occurredAt?(event.occurredAt|date:'medium'):'Not reported'}}</span><span>{{event.evidencePath?'Available':'Unavailable'}}</span></div>
        <div class="empty" *ngIf="connected&&!events.length">No Firebase events found.</div>
      </div>
    </article>`,
  styles: [`.live-panel{margin-top:16px;overflow-x:auto}.live-event-head,.live-event-row{min-width:650px;grid-template-columns:1.3fr .8fr 1fr 1.2fr .7fr}.live-event-row small{display:block;color:#87928a;margin-top:4px}.connection{font-size:9px;color:#78857c}.connection.connected{color:#367448}.live-panel code{font-size:11px}`],
})
export class FirebaseEventsPanelComponent implements OnInit, OnDestroy {
  events: FirebaseEvent[] = [];
  connected = false;
  error: FirestoreError | null = null;
  private stop?: () => void;
  constructor(private readonly firebase: FirebaseDataService) {}
  ngOnInit(): void { this.stop=this.firebase.watchEvents((items,fromCache)=>{this.events=[...items].sort((a,b)=>(b.occurredAt?.getTime()??0)-(a.occurredAt?.getTime()??0));this.connected=!fromCache;this.error=null;},(error)=>{this.error=error;this.connected=false;}); }
  ngOnDestroy(): void { this.stop?.(); }
  coordinates(event: FirebaseEvent): string { return event.latitude!==null&&event.longitude!==null?`${event.latitude}, ${event.longitude}`:'Not reported'; }
}

@Component({
  selector: 'fg-firebase-alerts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="panel live-panel"><div class="panel-head"><div><h3>Android alerts · Firebase</h3><p>Realtime documents from <code>alerts</code></p></div><span class="connection" [class.connected]="connected">{{connected?'LISTENING':'CONNECTING'}}</span></div>
      <p class="error" *ngIf="error">Unable to read Firebase alerts: {{error.message}}</p>
      <div class="table"><div class="row live-alert-head"><span>ALERT</span><span>DEVICE / SOUND</span><span>PRIORITY</span><span>LOCATION</span><span>TIME / STATUS</span></div>
        <div class="row live-alert-row" *ngFor="let alert of alerts" [class.high-priority]="isHighPriority(alert)"><span><b>{{alert.message||alert.type||'Forest monitoring alert'}}</b><small>{{alert.id}}</small></span><span>{{alert.deviceId||'Not reported'}}<small>{{alert.type||'Sound not reported'}}</small></span><span>{{alert.priority||'Not reported'}}</span><span>{{coordinates(alert)}}</span><span>{{alert.createdAt?(alert.createdAt|date:'short'):'Not reported'}}<small>{{alert.status||'Not reported'}}</small></span></div>
        <div class="empty" *ngIf="connected&&!alerts.length">No Firebase alerts found.</div>
      </div>
    </article>`,
  styles: [`.live-panel{margin-top:16px;overflow-x:auto}.live-alert-head,.live-alert-row{min-width:650px;grid-template-columns:1.2fr 1fr .7fr 1fr 1fr}.live-alert-row small{display:block;color:#87928a;margin-top:4px}.live-alert-row.high-priority{background:#fff5f2}.connection{font-size:9px;color:#78857c}.connection.connected{color:#367448}.live-panel code{font-size:11px}`],
})
export class FirebaseAlertsPanelComponent implements OnInit, OnDestroy {
  alerts: FirebaseAlert[]=[];
  connected=false;
  error:FirestoreError|null=null;
  private stop?:()=>void;
  constructor(private readonly firebase:FirebaseDataService){}
  ngOnInit():void { this.stop=this.firebase.watchAlerts((items,fromCache)=>{this.alerts=[...items].sort((a,b)=>(b.createdAt?.getTime()??0)-(a.createdAt?.getTime()??0));this.connected=!fromCache;this.error=null;},(error)=>{this.error=error;this.connected=false;}); }
  ngOnDestroy():void { this.stop?.(); }
  coordinates(alert:FirebaseAlert):string{return alert.latitude!==null&&alert.longitude!==null?`${alert.latitude}, ${alert.longitude}`:'Not reported';}
  isHighPriority(alert:FirebaseAlert):boolean{return ['HIGH','CRITICAL'].includes((alert.priority??'').toUpperCase())||['CHAINSAW','AXE_IMPACT'].includes(alert.type??'');}
}
