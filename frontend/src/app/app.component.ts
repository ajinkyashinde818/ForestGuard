import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  template: `
    <div class="shell">
      <aside>
        <div class="brand">
          <span class="brand-icon">F</span>
          <span>Forest<span class="accent">Guard</span><small>AI MONITORING</small></span>
        </div>
        <nav>
          <a routerLink="/">Overview</a>
          <a routerLink="/map">Live map</a>
          <a routerLink="/devices">Devices</a>
          <a routerLink="/events">Events</a>
          <a routerLink="/alerts">Alerts</a>
          <span class="nav-muted">DEVICES</span>
          <a routerLink="/users" *ngIf="auth.isAdmin">User management</a>
        </nav>
        <div class="side-note"><i></i> Monitoring services<br><small>API status available in dashboard</small></div>
        <div class="profile">
          <div class="avatar">FG</div>
          <div>Forest operations<small>Authorized access</small></div>
          <button type="button" (click)="auth.logout()" aria-label="Sign out">Sign out</button>
        </div>
      </aside>
      <main>
        <header>
          <div><div class="eyebrow">FOREST OPERATIONS</div><h1>Forest monitoring</h1></div>
          <div class="top-right"><span class="live-pill"><i></i> SYSTEM READY</span><span class="top-avatar">FG</span></div>
        </header>
        <router-outlet />
      </main>
    </div>
  `,
})
export class AppComponent {
  constructor(public auth: AuthService) {}
}
