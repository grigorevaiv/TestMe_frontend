import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SessionStorageService {

  private key = 'TestId';

  setTestId(id: number): void {
    sessionStorage.setItem(this.key, id.toString());
  }

  getTestId(): number | null {
    const value = sessionStorage.getItem(this.key);
    return value ? +value : null;
  }

  clear(): void {
    sessionStorage.removeItem(this.key);
  }
  
}
