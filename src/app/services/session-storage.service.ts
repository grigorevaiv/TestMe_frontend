import { Injectable } from '@angular/core';
import { TestSession } from '../interfaces/test.interface';

@Injectable({
  providedIn: 'root'
})
export class SessionStorageService {

  private key = 'TestId';
  private patientKey = 'PatientId';
  private testSessionKey = 'TestSession';

  setTestId(id: number): void {
    sessionStorage.setItem(this.key, id.toString());
  }

  getTestId(): number | null {
    const value = sessionStorage.getItem(this.key);
    return value ? +value : null;
  }

  setPatientId(id: number): void {
    sessionStorage.setItem(this.patientKey, id.toString());
  }

  getPatientId(): number | null {
    const value = sessionStorage.getItem(this.patientKey);
    return value ? +value : null;
  }  

  clear(): void {
    sessionStorage.removeItem(this.key);
  }

  clearPatient(): void {
    sessionStorage.removeItem(this.patientKey);
  }

  setTestSession(session: TestSession): void {
    sessionStorage.setItem(this.testSessionKey, JSON.stringify(session));
  }

  getTestSession(): TestSession | null {
    const raw = sessionStorage.getItem(this.testSessionKey);
    return raw ? JSON.parse(raw) as TestSession : null;
  }

  clearTestSession(): void {
    sessionStorage.removeItem(this.testSessionKey);
  }

  clearAll(): void {
    this.clear();
    this.clearPatient();
    this.clearTestSession();
  }
  
}
