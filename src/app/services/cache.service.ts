import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  constructor() { }

  private cacheName = 'TestMeCache';

  async saveToCache(key: string, data: any): Promise<void> {
    const cache = await caches.open(this.cacheName);
    const response = new Response(JSON.stringify(data)); 
    await cache.put(key, response);
  }

  async getFromCache(key: string): Promise<any | null> {
    const cache = await caches.open(this.cacheName);
    const response = await cache.match(key);
    if (response) {
      return await response.json();
    }
    return null;
  }
}
