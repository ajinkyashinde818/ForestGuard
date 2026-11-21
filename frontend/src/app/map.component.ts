import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { API } from './auth.service';
import { LiveService } from './live.service';
import { FirebaseDataService, FirebaseDevice, FirebaseEvent } from './firebase/firebase-data.service';

interface Coordinates {
  latitude: number | null;
  longitude: number | null;
}

interface DeviceMapItem extends Coordinates {
  id: string;
  deviceCode: string;
  name: string;
  status: string;
  battery: number | null;
  lastSeen: string | null;
  isDemo: boolean;
}

interface EventMapItem extends Coordinates {
  id: string;
  type: string;
  status: string;
  occurredAt: string;
  isDemo: boolean;
  device: { deviceCode: string; name: string };
}

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="welcome">
      <div><h2>Live forest map</h2><p>Only coordinates reported by devices or events are shown.</p></div>
      <span class="demo-badge">{{ deviceCount }} DEVICES · {{ eventCount }} EVENTS</span>
    </section>
    <div class="map-key">
      <span><i class="map-dot online"></i>Online device</span>
      <span><i class="map-dot warning"></i>Warning device</span>
      <span><i class="map-dot offline"></i>Offline device</span>
      <span><i class="map-dot event"></i>Event</span>
    </div>
    <div #mapElement class="forest-map" aria-label="Forest monitoring device and event map"></div>
    <p class="error" *ngIf="firebaseDeviceError">Firebase device locations unavailable: {{firebaseDeviceError}}</p>
    <p class="error" *ngIf="firebaseEventError">Firebase event locations unavailable: {{firebaseEventError}}</p>
    <p class="map-footnote">Map tiles © OpenStreetMap contributors. Device and event positions use backend-reported GPS only.</p>
  `,
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapElement') private mapElement!: ElementRef<HTMLDivElement>;
  private readonly http = inject(HttpClient);
  private readonly live = inject(LiveService);
  private readonly firebase = inject(FirebaseDataService);
  private map?: L.Map;
  private markers?: L.LayerGroup;
  private firebaseMarkers?: L.LayerGroup;
  private readonly removeListeners: Array<() => void> = [];
  private firebaseDevices: FirebaseDevice[] = [];
  private firebaseEvents: FirebaseEvent[] = [];
  deviceCount = 0;
  eventCount = 0;
  firebaseDeviceError = '';
  firebaseEventError = '';

  ngAfterViewInit(): void {
    this.map = L.map(this.mapElement.nativeElement, { zoomControl: true }).setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
    this.markers = L.layerGroup().addTo(this.map);
    this.firebaseMarkers = L.layerGroup().addTo(this.map);
    this.refresh();
    this.removeListeners.push(this.firebase.watchDevices((devices)=>{this.firebaseDevices=devices;this.firebaseDeviceError='';this.drawFirebaseMarkers();},(error)=>{this.firebaseDeviceError=error.message;}));
    this.removeListeners.push(this.firebase.watchEvents((events)=>{this.firebaseEvents=events;this.firebaseEventError='';this.drawFirebaseMarkers();},(error)=>{this.firebaseEventError=error.message;}));
    for (const eventName of ['device.updated', 'device.heartbeat', 'device.offline', 'event.created', 'event.updated']) {
      this.removeListeners.push(this.live.on(eventName, () => this.refresh()));
    }
  }

  ngOnDestroy(): void {
    for (const remove of this.removeListeners) remove();
    this.map?.remove();
  }

  private refresh(): void {
    this.http.get<DeviceMapItem[]>(`${API}/devices`).subscribe({
      next: (devices) => {
        this.deviceCount = devices.length;
        this.http.get<{ items: EventMapItem[] }>(`${API}/events?page=1&pageSize=100`).subscribe({
          next: (response) => {
            this.eventCount = response.items.length;
            this.draw(devices, response.items);
          },
        });
      },
    });
  }

  private draw(devices: DeviceMapItem[], events: EventMapItem[]): void {
    if (!this.map || !this.markers) return;
    this.markers.clearLayers();
    const bounds: L.LatLngTuple[] = [];

    for (const device of devices) {
      if (!this.hasCoordinates(device)) continue;
      const color = device.status === 'ONLINE' ? '#3d8a58' : device.status === 'WARNING' ? '#d59a32' : '#7e8b84';
      const marker = L.circleMarker([device.latitude, device.longitude], {
        radius: 8,
        color,
        fillColor: color,
        fillOpacity: 0.86,
        weight: 2,
      });
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = `${device.name} (${device.deviceCode})`;
      const state = document.createElement('p');
      state.textContent = `Status: ${device.status} · Battery: ${device.battery ?? 'Unknown'}%`;
      const time = document.createElement('small');
      time.textContent = device.lastSeen ? `Last heartbeat: ${new Date(device.lastSeen).toLocaleString()}` : 'No heartbeat recorded';
      popup.append(title, state, time);
      if (device.isDemo) {
        const demo = document.createElement('p');
        demo.textContent = 'DEMO DEVICE';
        popup.append(demo);
      }
      marker.bindPopup(popup).addTo(this.markers);
      bounds.push([device.latitude, device.longitude]);
    }

    for (const event of events) {
      if (!this.hasCoordinates(event)) continue;
      const marker = L.circleMarker([event.latitude, event.longitude], {
        radius: 7,
        color: '#c94c3c',
        fillColor: '#db6652',
        fillOpacity: 0.9,
        weight: 2,
      });
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = `Possible ${event.type.toLowerCase().replace('_', ' ')} sound`;
      const detail = document.createElement('p');
      detail.textContent = `${event.device.name} · ${event.status} · ${new Date(event.occurredAt).toLocaleString()}`;
      popup.append(title, detail);
      if (event.isDemo) {
        const demo = document.createElement('p');
        demo.textContent = 'DEMO EVENT';
        popup.append(demo);
      }
      marker.bindPopup(popup).addTo(this.markers);
      bounds.push([event.latitude, event.longitude]);
    }

    if (bounds.length) this.map.fitBounds(bounds, { padding: [28, 28], maxZoom: 12 });
  }

  private drawFirebaseMarkers(): void {
    if (!this.map || !this.firebaseMarkers) return;
    this.firebaseMarkers.clearLayers();
    const bounds: L.LatLngTuple[] = [];
    for (const device of this.firebaseDevices) {
      if (!this.hasCoordinates(device)) continue;
      const color = device.status?.toUpperCase()==='ONLINE' ? '#257347' : '#397fa3';
      const marker = L.circleMarker([device.latitude,device.longitude],{radius:9,color,fillColor:color,fillOpacity:.9,weight:2});
      const popup=document.createElement('div');
      const title=document.createElement('strong');title.textContent=device.name||`Device ${device.id}`;
      const info=document.createElement('p');info.textContent=`${device.status||'Status not reported'} · Battery ${device.battery===null?'not reported':device.battery+'%'}`;
      const point=document.createElement('small');point.textContent=`${device.latitude}, ${device.longitude}`;
      const heartbeat=document.createElement('small');heartbeat.textContent=device.lastHeartbeat?`Last heartbeat: ${device.lastHeartbeat.toLocaleString()}`:'Heartbeat not reported';
      popup.append(title,info,point,document.createElement('br'),heartbeat);marker.bindPopup(popup).addTo(this.firebaseMarkers);bounds.push([device.latitude,device.longitude]);
    }
    for (const event of this.firebaseEvents) {
      if (!this.hasCoordinates(event)) continue;
      const marker=L.circleMarker([event.latitude,event.longitude],{radius:8,color:'#b84338',fillColor:'#d45f51',fillOpacity:.9,weight:2});
      const popup=document.createElement('div');const title=document.createElement('strong');title.textContent=event.type||'Forest event';
      const device=document.createElement('p');device.textContent=`Device: ${event.deviceId||'not reported'}`;
      const timestamp=document.createElement('small');timestamp.textContent=event.occurredAt?.toLocaleString()||'Time not reported';
      const point=document.createElement('small');point.textContent=`${event.latitude}, ${event.longitude}${event.accuracy!==null?` · GPS accuracy ${event.accuracy} m`:''}`;
      popup.append(title,device,timestamp,document.createElement('br'),point);marker.bindPopup(popup).addTo(this.firebaseMarkers);bounds.push([event.latitude,event.longitude]);
    }
    if(bounds.length)this.map.fitBounds(bounds,{padding:[28,28],maxZoom:12});
  }

  private hasCoordinates(item: Coordinates): item is Coordinates & { latitude: number; longitude: number } {
    return typeof item.latitude === 'number' && Number.isFinite(item.latitude) &&
      typeof item.longitude === 'number' && Number.isFinite(item.longitude);
  }
}
