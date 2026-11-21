import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { API } from './auth.service';
import { LiveService } from './live.service';
import { FirebaseAlert, FirebaseDataService, FirebaseDevice, FirebaseEvent } from './firebase/firebase-data.service';

interface DashboardSummary {
  totalDevices: number; onlineDevices: number; offlineDevices: number; totalEvents: number;
  newEvents: number; awaitingReview: number; verifiedEvents: number; falsePositiveEvents: number; activeAlerts: number;
}
interface RecentEvent {
  id: string; type: string; status: string; severity: string | null; description: string | null;
  occurredAt: string; isDemo: boolean; device: { deviceCode: string; name: string };
}
interface Aggregate { type?: string; status?: string; _count: { _all: number }; }
interface EventStatistics { byType: Aggregate[]; byStatus: Aggregate[]; }

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="welcome"><div><h2>Forest operations overview</h2><p>Current device availability and event review activity.</p></div><span class="demo-badge">LIVE DATA · FORESTGUARD API</span></section>
    <p class="error" *ngIf="error" role="alert">{{error}} <button class="text-button" (click)="load()">Retry</button></p>
    <p class="loading" *ngIf="loading">Loading monitoring data…</p>
    <section class="metrics" *ngIf="summary as s">
      <article class="metric"><div class="metric-label">TOTAL DEVICES</div><div class="metric-value">{{s.totalDevices}}</div><div class="metric-foot">Registered monitoring nodes</div></article>
      <article class="metric"><div class="metric-label">ONLINE DEVICES</div><div class="metric-value">{{s.onlineDevices}}</div><div class="metric-foot">Currently reporting</div></article>
      <article class="metric"><div class="metric-label">OFFLINE DEVICES</div><div class="metric-value">{{s.offlineDevices}}</div><div class="metric-foot">Active devices past heartbeat timeout</div></article>
      <article class="metric"><div class="metric-label">ACTIVE ALERTS</div><div class="metric-value">{{s.activeAlerts}}</div><div class="metric-foot">Open alerts requiring attention</div></article>
      <article class="metric"><div class="metric-label">NEW EVENTS</div><div class="metric-value">{{s.newEvents}}</div><div class="metric-foot">Awaiting review</div></article>
      <article class="metric"><div class="metric-label">UNDER REVIEW</div><div class="metric-value">{{s.awaitingReview}}</div><div class="metric-foot">Officer verification in progress</div></article>
      <article class="metric"><div class="metric-label">VERIFIED</div><div class="metric-value">{{s.verifiedEvents}}</div><div class="metric-foot">Human reviewed events</div></article>
      <article class="metric"><div class="metric-label">FALSE POSITIVE</div><div class="metric-value">{{s.falsePositiveEvents}}</div><div class="metric-foot">Marked non-suspicious after review</div></article>
    </section>
    <section class="panel firebase-summary"><div class="panel-head"><div><h3>Android Firebase monitor</h3><p>Realtime data from the shared Firebase project</p></div><span class="connection" [class.connected]="firebaseConnected">{{firebaseConnected?'CONNECTED':'CONNECTING'}}</span></div>
      <div class="firebase-counts"><div><b>{{firebaseDevices.length}}</b><span>Devices loaded (up to 200)</span></div><div><b>{{firebaseEvents.length}}</b><span>Events loaded (up to 100)</span></div><div><b>{{suspiciousEventCount}}</b><span>Logging-related sounds loaded</span></div><div><b>{{highPriorityAlertCount}}</b><span>High-priority alerts loaded</span></div></div>
      <p class="error" *ngIf="firebaseError">Firebase listener error: {{firebaseError}}</p>
    </section>
    <article class="panel firebase-recent"><div class="panel-head"><div><h3>Android event feed</h3><p>Live event documents received from Firestore</p></div><a routerLink="/events">View events →</a></div>
      <div class="table"><div class="row firebase-event-row" *ngFor="let event of (firebaseEvents|slice:0:5)"><span><b>{{event.type||'Unclassified sound'}}</b><small>{{event.id}}</small></span><span>{{event.deviceId||'Device not reported'}}</span><span>{{event.latitude!==null&&event.longitude!==null?(event.latitude+', '+event.longitude):'Location not reported'}}</span><span>{{event.occurredAt?(event.occurredAt|date:'short'):'Time not reported'}}</span></div>
        <div class="empty" *ngIf="firebaseConnected&&!firebaseEvents.length">No Firebase events found.</div>
      </div>
    </article>
    <section class="content-grid">
      <article class="panel"><div class="panel-head"><div><h3>Recent events</h3><p>Possible sound events require human verification</p></div><a routerLink="/events">View all →</a></div>
        <div class="table"><div class="row row-head"><span>CLASSIFICATION</span><span>DEVICE</span><span>STATUS</span><span>TIME</span></div>
          <div class="row" *ngFor="let event of events"><span><a [routerLink]="['/events',event.id]"><b>{{event.type}}</b></a><small>{{event.description || 'No explanation provided'}} <em *ngIf="event.isDemo">· DEMO</em></small></span><span>{{event.device.deviceCode}}</span><span><i class="status" [class.urgent]="event.status==='NEW'"></i>{{event.status}}</span><span>{{event.occurredAt|date:'short'}}</span></div>
          <div class="empty" *ngIf="!events.length && !loading">No events found.</div>
        </div>
      </article>
      <article class="panel charts"><div class="panel-head"><div><h3>Event distribution</h3><p>Counts from all recorded events</p></div></div>
        <h4>By event type</h4><div class="chart-row" *ngFor="let item of typeStats"><span>{{item.name}}</span><i><b [style.width.%]="barWidth(item.count,maxTypeCount)"></b></i><strong>{{item.count}}</strong></div><p class="empty" *ngIf="!typeStats.length">No event data yet.</p>
        <h4>Status</h4><div class="chart-row" *ngFor="let item of statusStats"><span>{{item.name}}</span><i><b [style.width.%]="barWidth(item.count,maxStatusCount)"></b></i><strong>{{item.count}}</strong></div><p class="empty" *ngIf="!statusStats.length">No status data yet.</p>
      </article>
    </section>
    <p class="disclaimer">AI classifications describe possible sound categories only. They do not establish illegal logging. Human verification is required.</p>
  `,
  styles: [`.metrics{grid-template-columns:repeat(4,minmax(0,1fr))}.charts h4{font-size:11px;margin:20px 0 10px}.chart-row{display:grid;grid-template-columns:1fr minmax(70px,1.2fr) 28px;gap:8px;align-items:center;margin:9px 0;font-size:10px;color:#647168}.chart-row i{height:7px;background:#edf1ed;border-radius:5px;overflow:hidden}.chart-row i b{display:block;height:100%;background:#67a96d;border-radius:5px}.chart-row strong{text-align:right;color:#35473b}.text-button{border:0;background:none;color:#28613d;text-decoration:underline;cursor:pointer}.loading{color:#748078;font-size:12px}.firebase-summary,.firebase-recent{margin:16px 0}.firebase-counts{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.firebase-counts div{display:flex;flex-direction:column;gap:4px}.firebase-counts b{font-size:21px}.firebase-counts span{font-size:10px;color:#748078}.firebase-event-row{grid-template-columns:1fr .8fr 1fr .8fr}.connection{font-size:9px;color:#78857c}.connection.connected{color:#367448}@media(max-width:1100px){.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.firebase-counts{grid-template-columns:repeat(2,1fr)}.firebase-event-row{grid-template-columns:1fr 1fr}.firebase-event-row span:nth-child(n+3){display:none}}`],
})
export class DashboardComponent implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly live = inject(LiveService);
  private readonly firebase = inject(FirebaseDataService);
  private readonly removeListeners: Array<() => void> = [];
  private readonly removeFirebaseListeners: Array<() => void> = [];
  summary?: DashboardSummary;
  events: RecentEvent[] = [];
  typeStats: Array<{name:string;count:number}> = [];
  statusStats: Array<{name:string;count:number}> = [];
  loading = true;
  error = '';
  firebaseConnected = false;
  firebaseError = '';
  firebaseDevices: FirebaseDevice[] = [];
  firebaseEvents: FirebaseEvent[] = [];
  firebaseAlerts: FirebaseAlert[] = [];

  constructor() {
    this.load();
    for (const event of ['event.created','event.updated','alert.updated','device.updated','device.heartbeat','device.offline']) {
      this.removeListeners.push(this.live.on(event, () => this.load()));
    }
    this.removeFirebaseListeners.push(this.firebase.watchDevices((items,fromCache)=>{this.firebaseDevices=items;this.firebaseConnected=!fromCache;this.firebaseError='';},(error)=>{this.firebaseConnected=false;this.firebaseError=error.message;}));
    this.removeFirebaseListeners.push(this.firebase.watchEvents((items,fromCache)=>{this.firebaseEvents=[...items].sort((a,b)=>(b.occurredAt?.getTime()??0)-(a.occurredAt?.getTime()??0));this.firebaseConnected=!fromCache;this.firebaseError='';},(error)=>{this.firebaseConnected=false;this.firebaseError=error.message;}));
    this.removeFirebaseListeners.push(this.firebase.watchAlerts((items,fromCache)=>{this.firebaseAlerts=items;this.firebaseConnected=!fromCache;this.firebaseError='';},(error)=>{this.firebaseConnected=false;this.firebaseError=error.message;}));
  }

  get maxTypeCount(): number { return Math.max(0,...this.typeStats.map(item=>item.count)); }
  get maxStatusCount(): number { return Math.max(0,...this.statusStats.map(item=>item.count)); }
  get suspiciousEventCount(): number { return this.firebaseEvents.filter((event)=>['CHAINSAW','AXE_IMPACT','HAND_SAW','TREE_FALL','WOOD_CUTTING','MACHINERY'].includes(event.type??'')).length; }
  get highPriorityAlertCount(): number { return this.firebaseAlerts.filter((alert)=>['HIGH','CRITICAL'].includes((alert.priority??'').toUpperCase())||['CHAINSAW','AXE_IMPACT'].includes(alert.type??'')).length; }
  barWidth(value:number,max:number):number { return max ? Math.max(3,(value/max)*100) : 0; }

  load(): void {
    this.loading = true;
    this.error = '';
    this.http.get<DashboardSummary>(`${API}/dashboard/summary`).subscribe({next:value=>{this.summary=value;this.loading=false;},error:()=>{this.loading=false;this.error='Unable to load dashboard summary.';}});
    this.http.get<RecentEvent[]>(`${API}/dashboard/recent-events`).subscribe({next:value=>this.events=value,error:()=>this.error='Unable to load recent events.'});
    this.http.get<EventStatistics>(`${API}/dashboard/event-statistics`).subscribe({next:value=>{
      this.typeStats=value.byType.map(item=>({name:item.type??'UNKNOWN',count:item._count._all})).sort((a,b)=>b.count-a.count);
      this.statusStats=value.byStatus.map(item=>({name:item.status??'UNKNOWN',count:item._count._all})).sort((a,b)=>b.count-a.count);
    },error:()=>this.error='Unable to load event statistics.'});
  }

  ngOnDestroy(): void { for (const remove of [...this.removeListeners,...this.removeFirebaseListeners]) remove(); }
}
