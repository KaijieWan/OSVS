import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {  
  private apiKey = 'AIzaSyDpAvUQrZy0aKFgTT26AsocV1-7HVvLlkk';  // Store API key securely
  private apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;

  private conversationHistory: string[] = [];  // Array to keep track of the conversation

  constructor(private http: HttpClient) {}

  sendMessageToGemini(message: string): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: message }]
        }
      ]
    };
    return this.http.post(this.apiUrl, body, { headers });
  }

  // Optionally, clear conversation history after a session ends
  clearConversation() {
    this.conversationHistory = [];
  }
}
