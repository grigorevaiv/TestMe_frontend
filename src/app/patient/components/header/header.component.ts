import { Component, inject } from '@angular/core';
import { User } from '../../../interfaces/test.interface';
import { PatientResourceService } from '../../../services/patient-resource.service';
import { SessionStorageService } from '../../../services/session-storage.service';

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {

  patientFullName = '';

  ngOnInit() {
    let data = sessionStorage.getItem('TestSession');
    if (data) {
      let parsedData = JSON.parse(data);
      this.patientFullName = parsedData.firstName + ' ' + parsedData.lastName;
    }
  }
}
