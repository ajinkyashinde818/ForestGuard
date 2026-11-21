import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';

@Injectable({providedIn:'root'})
export class LiveService {
  private socket?:Socket;
  connect():void {
    const token=localStorage.getItem('fg_token');
    if(!token)return;
    if(this.socket){if(!this.socket.connected)this.socket.connect();return;}
    this.socket=io(`${location.origin}/live`,{auth:{token},transports:['websocket','polling']});
  }
  on(event:string,handler:(payload:any)=>void):()=>void { this.connect(); this.socket?.on(event,handler); return ()=>this.socket?.off(event,handler); }
  disconnect():void { this.socket?.disconnect(); this.socket=undefined; }
}
