import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { API } from './auth.service';

interface EventDetail {
  id: string;
  type: string;
  status: string;
  confidence: number | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  occurredAt: string;
  isDemo: boolean;
  device: { deviceCode: string; name: string };
  audio: { mimeType: string; byteSize: number; createdAt: string } | null;
  analyses: Array<{
    status: string;
    type: string | null;
    confidence: number | null;
    description: string | null;
    reasoningSummary: string | null;
    alternatives: string[];
    severity: string | null;
    requiresHumanReview: boolean;
  }>;
  reviews: Array<{
    status: string;
    note: string | null;
    createdAt: string;
    user: { name: string; role: string };
  }>;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="welcome">
      <div><h2>Event investigation</h2><p>Review the original report, location, evidence and analysis.</p></div>
      <span class="demo-badge" *ngIf="event?.isDemo">DEMO RECORD</span>
    </section>
    <p class="error" *ngIf="error">{{ error }}</p>
    <div class="detail-grid" *ngIf="event as item">
      <article class="panel">
        <div class="panel-head"><div><h3>{{ item.type }}</h3><p>Possible sound classification · human review required</p></div><span class="demo-badge">{{ item.status }}</span></div>
        <div class="detail-fields">
          <div><small>DEVICE</small><b>{{ item.device.name }} ({{ item.device.deviceCode }})</b></div>
          <div><small>REPORTED</small><b>{{ item.occurredAt | date:'medium' }}</b></div>
          <div><small>GPS COORDINATES</small><b *ngIf="item.latitude !== null && item.longitude !== null">{{ item.latitude }}, {{ item.longitude }}</b><b *ngIf="item.latitude === null || item.longitude === null">Unavailable</b></div>
          <div><small>DEVICE CLASSIFICATION SCORE</small><b>{{ item.confidence === null ? 'Not supplied' : item.confidence }}</b></div>
        </div>
        <p class="detail-description">{{ item.description || 'No device explanation was supplied.' }}</p>
        <a *ngIf="item.latitude !== null && item.longitude !== null" [href]="mapUrl(item)" target="_blank" rel="noopener">Open reported coordinates in OpenStreetMap</a>
        <section class="evidence-section">
          <h3>Audio evidence</h3>
          <audio *ngIf="audioUrl" [src]="audioUrl" controls preload="metadata"></audio>
          <p *ngIf="item.audio && !audioUrl">Loading protected evidence…</p>
          <p *ngIf="!item.audio">No audio evidence is attached to this event.</p>
          <small *ngIf="item.audio">{{ item.audio.mimeType }} · {{ item.audio.byteSize | number }} bytes</small>
        </section>
      </article>
      <article class="panel">
        <div class="panel-head"><div><h3>AI assessment</h3><p>Advisory output only; not proof of illegal activity</p></div></div>
        <ng-container *ngFor="let analysis of item.analyses">
          <div class="analysis-card">
            <b>{{ analysis.status }}<span *ngIf="analysis.type"> · {{ analysis.type }}</span></b>
            <p>{{ analysis.description || 'No completed analysis yet.' }}</p>
            <small *ngIf="analysis.confidence !== null">Model-reported confidence: {{ analysis.confidence }}</small>
            <p *ngIf="analysis.reasoningSummary">{{ analysis.reasoningSummary }}</p>
            <small *ngIf="analysis.alternatives.length">Alternatives: {{ analysis.alternatives.join(', ') }}</small>
            <p class="review-required" *ngIf="analysis.requiresHumanReview">Human verification required.</p>
          </div>
        </ng-container>
        <p *ngIf="!item.analyses.length">No AI analysis is available. Analysis may be disabled or still pending.</p>
      </article>
      <article class="panel review-panel">
        <div class="panel-head"><div><h3>Human review</h3><p>Changes are stored with an audit note.</p></div></div>
        <div class="review-actions">
          <button class="primary" (click)="setStatus('UNDER_REVIEW')" [disabled]="saving">Start review</button>
          <button class="primary" (click)="setStatus('VERIFIED')" [disabled]="saving">Mark verified</button>
          <button class="secondary" (click)="setStatus('FALSE_POSITIVE')" [disabled]="saving">False positive</button>
          <button class="secondary" (click)="setStatus('CLOSED')" [disabled]="saving">Close event</button>
        </div>
        <label for="review-note">Officer note</label>
        <textarea id="review-note" [(ngModel)]="note" rows="3" placeholder="Record what was checked and why"></textarea>
        <div class="review-history" *ngFor="let review of item.reviews">
          <b>{{ review.status }}</b><small>{{ review.user.name }} · {{ review.createdAt | date:'short' }}</small>
          <p *ngIf="review.note">{{ review.note }}</p>
        </div>
      </article>
    </div>
  `,
})
export class EventDetailComponent implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private audioObjectUrl?: string;
  event?: EventDetail;
  error = '';
  note = '';
  saving = false;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'No event ID was provided.';
      return;
    }
    this.load(id);
  }

  get audioUrl(): string | undefined {
    return this.audioObjectUrl;
  }

  mapUrl(item: EventDetail): string {
    return `https://www.openstreetmap.org/?mlat=${item.latitude}&mlon=${item.longitude}#map=16/${item.latitude}/${item.longitude}`;
  }

  setStatus(status: 'UNDER_REVIEW' | 'VERIFIED' | 'FALSE_POSITIVE' | 'CLOSED'): void {
    if (!this.event) return;
    if ((status === 'VERIFIED' || status === 'FALSE_POSITIVE' || status === 'CLOSED') &&
        !window.confirm(`Confirm event status: ${status.replace('_', ' ')}?`)) return;
    this.saving = true;
    this.error = '';
    this.http.patch(`${API}/events/${this.event.id}/status`, { status, note: this.note || undefined })
      .subscribe({
        next: () => { this.saving = false; this.note = ''; this.load(this.event!.id); },
        error: () => { this.saving = false; this.error = 'Could not save the review. Check your permissions and connection.'; },
      });
  }

  ngOnDestroy(): void {
    if (this.audioObjectUrl) URL.revokeObjectURL(this.audioObjectUrl);
  }

  private load(id: string): void {
    this.http.get<EventDetail>(`${API}/events/${id}`).subscribe({
      next: (event) => {
        this.event = event;
        if (event.audio) this.loadAudio(id);
      },
      error: () => { this.error = 'Event could not be loaded.'; },
    });
  }

  private loadAudio(id: string): void {
    this.http.get(`${API}/events/${id}/audio`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        if (this.audioObjectUrl) URL.revokeObjectURL(this.audioObjectUrl);
        this.audioObjectUrl = URL.createObjectURL(blob);
      },
      error: () => { this.error = 'Protected audio evidence could not be loaded.'; },
    });
  }
}
