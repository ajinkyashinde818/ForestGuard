import { bootstrapApplication } from '@angular/platform-browser';
import { APP_INITIALIZER } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/auth.service';
import { firebaseAuthPersistence } from './app/firebase/firebase.client';
import { FirebaseDataService } from './app/firebase/firebase-data.service';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    {
      provide: APP_INITIALIZER,
      useFactory: (_firebase: FirebaseDataService) => () => firebaseAuthPersistence,
      deps: [FirebaseDataService],
      multi: true,
    },
  ],
}).catch(console.error);
