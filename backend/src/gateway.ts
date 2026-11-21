import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { OnGatewayConnection } from '@nestjs/websockets';
@WebSocketGateway({namespace:'/live',cors:{origin:(process.env.CORS_ORIGIN||'http://localhost:4200').split(',')}})
export class LiveGateway implements OnGatewayConnection {
 @WebSocketServer() server:Server;
 constructor(private jwt:JwtService){}
 handleConnection(client:Socket){try{const token=client.handshake.auth?.token;if(!token)throw Error();const claims=this.jwt.verify(token);client.data.user=claims;if(!['ADMIN','FOREST_OFFICER'].includes(claims.role))throw Error();}catch{client.disconnect(true);}}
 publish(name:string,payload:unknown){this.server?.emit(name,payload);}
}
