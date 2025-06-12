import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  constructor(private router: Router) {}
  dropdownOpen = false;
  menuOpen = false;
  adminName: string = '';

  ngOnInit() {
    const fullname = localStorage.getItem('admin_name');
    if(fullname) {
      const name = fullname.split(' ')[0];
      this.adminName = name || 'Admin';
    }
  }
  
  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/login']);    
  }
}
