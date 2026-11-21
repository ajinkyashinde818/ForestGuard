import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  FirestoreError,
  getDoc,
  limit,
  onSnapshot,
  QueryConstraint,
  query,
} from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { firebaseServices } from './firebase.client';

/** Firestore data paired with its document ID; Android-specific fields remain unmapped. */
export interface FirebaseDocument<T extends object = Record<string, unknown>> {
  id: string;
  data: T;
}

export interface FirebaseDevice {
  id: string;
  name: string | null;
  status: string | null;
  battery: number | null;
  charging: boolean | string | null;
  network: string | null;
  monitoringStatus: string | null;
  lastHeartbeat: Date | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
}

export interface FirebaseEvent {
  id: string;
  deviceId: string | null;
  type: string | null;
  occurredAt: Date | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  status: string | null;
  evidencePath: string | null;
  description: string | null;
}

export interface FirebaseAlert {
  id: string;
  deviceId: string | null;
  eventId: string | null;
  type: string | null;
  message: string | null;
  priority: string | null;
  status: string | null;
  createdAt: Date | null;
  latitude: number | null;
  longitude: number | null;
}

type RawDocument = Record<string, unknown>;

/** Schema-neutral Firestore access. Supply collection paths only after confirming Android's schema. */
@Injectable({ providedIn: 'root' })
export class FirebaseDataService {
  readonly firestore = firebaseServices.firestore;
  readonly storage = firebaseServices.storage;

  watchCollection<T extends object = Record<string, unknown>>(
    collectionPath: string,
    onData: (documents: FirebaseDocument<T>[], fromCache: boolean) => void,
    onError: (error: FirestoreError) => void,
    ...constraints: QueryConstraint[]
  ): () => void {
    const reference = collection(this.firestore, collectionPath);
    const target = constraints.length ? query(reference, ...constraints) : reference;
    return onSnapshot(target, (snapshot) => {
      onData(snapshot.docs.map((document) => ({
        id: document.id,
        data: document.data() as T,
      })), snapshot.metadata.fromCache);
    }, onError);
  }

  watchDevices(onData: (devices: FirebaseDevice[], fromCache: boolean) => void, onError: (error: FirestoreError) => void): () => void {
    return this.watchCollection('devices', (documents, fromCache) => onData(documents.map(({ id, data }) => mapDevice(id, data)), fromCache), onError, limit(200));
  }

  watchEvents(onData: (events: FirebaseEvent[], fromCache: boolean) => void, onError: (error: FirestoreError) => void): () => void {
    return this.watchCollection('events', (documents, fromCache) => onData(documents.map(({ id, data }) => mapEvent(id, data)), fromCache), onError, limit(100));
  }

  watchAlerts(onData: (alerts: FirebaseAlert[], fromCache: boolean) => void, onError: (error: FirestoreError) => void): () => void {
    return this.watchCollection('alerts', (documents, fromCache) => onData(documents.map(({ id, data }) => mapAlert(id, data)), fromCache), onError, limit(100));
  }

  async getEvent(eventId: string): Promise<FirebaseEvent | null> {
    const snapshot = await getDoc(doc(this.firestore, 'events', eventId));
    return snapshot.exists() ? mapEvent(snapshot.id, snapshot.data()) : null;
  }

  getEvidenceUrl(storagePath: string): Promise<string> {
    return getDownloadURL(ref(this.storage, storagePath));
  }
}

function firstValue(source: RawDocument, keys: string[]): unknown {
  for (const key of keys) if (source[key] !== undefined && source[key] !== null) return source[key];
  return undefined;
}

function record(value: unknown): RawDocument {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RawDocument : {};
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function stringValue(value: unknown): string | null { return typeof value === 'string' ? value : null; }

function dateValue(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    const date: unknown = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return null;
}

function locationOf(source: RawDocument): { latitude: number | null; longitude: number | null; accuracy: number | null } {
  const location = record(firstValue(source, ['location', 'gps', 'coordinates', 'position']));
  const geoPoint = firstValue(source, ['location', 'gps', 'coordinates', 'position']);
  const point = record(geoPoint);
  return {
    latitude: numberValue(firstValue(source, ['latitude', 'lat']) ?? firstValue(location, ['latitude', 'lat']) ?? point['latitude']),
    longitude: numberValue(firstValue(source, ['longitude', 'lng', 'lon']) ?? firstValue(location, ['longitude', 'lng', 'lon']) ?? point['longitude']),
    accuracy: numberValue(firstValue(source, ['accuracy', 'gpsAccuracy']) ?? firstValue(location, ['accuracy', 'gpsAccuracy'])),
  };
}

function mapDevice(id: string, source: RawDocument): FirebaseDevice {
  const coordinates = locationOf(source);
  const chargingValue = firstValue(source, ['charging', 'isCharging', 'chargingStatus']);
  return {
    id,
    name: stringValue(firstValue(source, ['name', 'deviceName', 'label'])),
    status: stringValue(firstValue(source, ['status', 'deviceStatus', 'connectionStatus'])),
    battery: numberValue(firstValue(source, ['battery', 'batteryLevel', 'batteryPercent', 'batteryPercentage'])),
    charging: typeof chargingValue === 'boolean' || typeof chargingValue === 'string' ? chargingValue : null,
    network: stringValue(firstValue(source, ['networkType', 'network', 'networkStatus'])),
    monitoringStatus: stringValue(firstValue(source, ['monitoringStatus', 'monitoring'])),
    lastHeartbeat: dateValue(firstValue(source, ['lastHeartbeat', 'heartbeat', 'lastSeen', 'updatedAt', 'timestamp'])),
    ...coordinates,
  };
}

function mapEvent(id: string, source: RawDocument): FirebaseEvent {
  const coordinates = locationOf(source);
  const deviceId = stringValue(firstValue(source, ['deviceId', 'deviceID']));
  return {
    id,
    deviceId,
    type: stringValue(firstValue(source, ['eventType', 'type', 'soundType', 'category'])),
    occurredAt: dateValue(firstValue(source, ['serverTimestamp', 'timestamp', 'detectedAt', 'occurredAt', 'createdAt'])),
    ...coordinates,
    status: stringValue(firstValue(source, ['status', 'reviewStatus'])),
    evidencePath: stringValue(firstValue(source, ['evidencePath', 'audioPath', 'storagePath']))
      ?? (deviceId ? `audio-events/${deviceId}/${id}/evidence.wav` : null),
    description: stringValue(firstValue(source, ['description', 'message'])),
  };
}

function mapAlert(id: string, source: RawDocument): FirebaseAlert {
  const coordinates = locationOf(source);
  return {
    id,
    deviceId: stringValue(firstValue(source, ['deviceId', 'deviceID'])),
    eventId: stringValue(firstValue(source, ['eventId', 'eventID'])),
    type: stringValue(firstValue(source, ['eventType', 'type', 'soundType', 'category'])),
    message: stringValue(firstValue(source, ['message', 'alert', 'description'])),
    priority: stringValue(firstValue(source, ['priority', 'severity', 'level'])),
    status: stringValue(firstValue(source, ['status', 'alertStatus'])),
    createdAt: dateValue(firstValue(source, ['serverTimestamp', 'timestamp', 'createdAt'])),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  };
}
