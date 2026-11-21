import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface DashboardPreferences {
  mapLatitude: number;
  mapLongitude: number;
  mapZoom: number;
  alertNotifications: boolean;
}

const STORAGE_KEY = 'fg_dashboard_preferences';
const DEFAULTS: DashboardPreferences = {
  mapLatitude: 0,
  mapLongitude: 0,
  mapZoom: 2,
  alertNotifications: true,
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="welcome"><div><h2>Dashboard settings</h2><p>Preferences for this browser and information about server-managed services.</p></div></section>
    <article class="panel settings-panel">
      <div class="panel-head"><div><h3>Map defaults</h3><p>Used as the initial view when no device locations are available.</p></div></div>
      <div class="settings-grid">
        <label>Latitude<input type="number" min="-90" max="90" step="any" [(ngModel)]="preferences.mapLatitude"></label>
        <label>Longitude<input type="number" min="-180" max="180" step="any" [(ngModel)]="preferences.mapLongitude"></label>
        <label>Zoom<input type="number" min="1" max="18" step="1" [(ngModel)]="preferences.mapZoom"></label>
      </div>
    </article>
    <article class="panel settings-panel">
      <div class="panel-head"><div><h3>Notifications</h3><p>Browser preference only. Push notifications require a separately configured notification service.</p></div></div>
      <label class="check"><input type="checkbox" [(ngModel)]="preferences.alertNotifications"> Show alert indicators in this dashboard</label>
    </article>
    <article class="panel settings-panel">
      <div class="panel-head"><div><h3>Server-managed services</h3><p>These values are controlled by backend configuration.</p></div></div>
      <dl><dt>Heartbeat timeout</dt><dd>Configured by <code>HEARTBEAT_TIMEOUT_SECONDS</code> (default 120 seconds).</dd>
        <dt>Audio evidence retention</dt><dd>Not configurable from the dashboard. Evidence remains protected by the backend API.</dd>
        <dt>AI analysis</dt><dd>Availability depends on server AI configuration. No analysis is shown unless the API returns a result.</dd></dl>
    </article>
    <div class="settings-actions"><button class="primary" (click)="save()">Save browser preferences</button><button class="secondary" (click)="reset()">Reset defaults</button><span role="status" *ngIf="notice">{{notice}}</span></div>
  `,
  styles: [`
    .settings-panel{margin-bottom:16px}.settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
    label{display:grid;gap:7px;color:#65736a;font-size:12px}.settings-grid input{padding:10px;border:1px solid #dbe2d9;border-radius:7px;font:inherit;color:#233229}
    .check{display:flex;align-items:center;gap:9px}.settings-panel dl{display:grid;grid-template-columns:minmax(150px,.5fr) 2fr;gap:12px;margin:0;font-size:12px}.settings-panel dt{font-weight:700}.settings-panel dd{margin:0;color:#748078}
    .settings-actions{display:flex;align-items:center;gap:12px}.settings-actions span{color:#427452;font-size:12px}.secondary{background:white;border:1px solid #d7dfd7;padding:10px 14px;border-radius:6px;color:#355540;cursor:pointer}
    @media(max-width:540px){.settings-panel dl{grid-template-columns:1fr;gap:5px}.settings-panel dd{margin-bottom:10px}}
  `],
})
export class SettingsComponent {
  preferences: DashboardPreferences = this.readPreferences();
  notice = '';

  save(): void {
    const { mapLatitude, mapLongitude, mapZoom } = this.preferences;
    if (mapLatitude < -90 || mapLatitude > 90 || mapLongitude < -180 || mapLongitude > 180 || mapZoom < 1 || mapZoom > 18) {
      this.notice = 'Use valid map coordinates and a zoom from 1 to 18.';
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences));
    this.notice = 'Preferences saved in this browser.';
  }

  reset(): void {
    this.preferences = { ...DEFAULTS };
    localStorage.removeItem(STORAGE_KEY);
    this.notice = 'Default preferences restored.';
  }

  private readPreferences(): DashboardPreferences {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (saved && typeof saved === 'object') return { ...DEFAULTS, ...saved } as DashboardPreferences;
    } catch { /* Ignore malformed browser preferences and use defaults. */ }
    return { ...DEFAULTS };
  }
}
