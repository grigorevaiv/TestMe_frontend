import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { InvitationPayload, User } from '../interfaces/test.interface';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PatientService {

  constructor() { }

  baseUrl = environment.PATIENTS_BASE_URL;
  http = inject(HttpClient);

  createPatient(patient: User): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}`, patient);
  }

  getPatients(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}`);
  }

  getPatientById(id: number): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/${id}`);
  }

  updatePatient(patient: User, patientId: number): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${patientId}`, patient);
  }

  assignTestToPatient(payload: InvitationPayload): Observable<any> {
    return this.http.post(`${this.baseUrl}/invitations`, payload);
  }

  verifyInvitation(token: string, email: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/invitations/verify`, { token, email });
  }




}
