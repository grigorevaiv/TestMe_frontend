import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { ToastComponent } from './components/toast/toast.component';
import { ToastService } from './services/toast.service';
import { filter } from 'rxjs';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, ToastComponent, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'TestMe';
  toastService = inject(ToastService);
    showNavbar = true;

  constructor(private router: Router) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
    const url = event.urlAfterRedirects || event.url;
    const knownPaths = this.router.config
      .filter(r => typeof r.path === 'string' && r.path !== '**')
      .map(r => {
        const path = r.path!;
        return path === '' ? '/' : '/' + path.split('/:')[0];
      });

    const isKnown = knownPaths.some(p => url === p || url.startsWith(p + '/'));

    this.showNavbar = !url.startsWith('/login') && !url.startsWith('/play-test') && !url.startsWith('/thank-you') && isKnown;
        });
      }
    }
