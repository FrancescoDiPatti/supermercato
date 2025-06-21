import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { provideHttpClient } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { 
  arrowForward, 
  arrowBack, 
  search, 
  cube, 
  checkmark, 
  add,
  play,
  chevronForward
} from 'ionicons/icons';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
addIcons({
  'arrow-forward': arrowForward,
  'arrow-back': arrowBack,
  'search': search,
  'cube': cube,
  'checkmark': checkmark,
  'add': add,
  'play': play,
  'chevron-forward': chevronForward
});

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({
      innerHTMLTemplatesEnabled: true,
      scrollPadding: false,
      scrollAssist: true
    }),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(),
  ],
});
