import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GeminiService } from './gemini.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { marked } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable } from 'rxjs/internal/Observable';
import { of, switchMap } from 'rxjs';


@Component({
  selector: 'app-chat-modal',
  templateUrl: './chat-modal.component.html',
  styleUrls: ['./chat-modal.component.scss'],
  
  imports: [FormsModule, CommonModule]
})
export class ChatModalComponent {
  userMessage: string = '';
  chatHistory: string[] = [];
  
  constructor(
    private geminiService: GeminiService,
    public dialogRef: MatDialogRef<ChatModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private sanitizer: DomSanitizer
  ) {}
  

  sendMessage() {
    if (this.userMessage.trim()) {
      this.chatHistory.push(`You: ${this.userMessage}`);
  
      let prompt = this.userMessage;
  
      // Check if dependencies exist and append them to the prompt
      if (this.userMessage.toLowerCase().includes('dependencies') && this.data?.dependencies?.length) {
        // Include all dependencies (with name, version, description)
        const formattedDeps = this.data.dependencies.map((dep: { name: any; version: any; latestVersion: any, description: any; }) =>
          `Package: ${dep.name}\nVersion: ${dep.version}\nLatest Versopm: ${dep.latestVersion}\nDescription: ${dep.description}`
        ).join('\n\n');
  
        prompt += `\n\nHere are the dependencies:\n${formattedDeps}`;
      }
  
      // Check if vulnerabilities exist and append them to the prompt
      if (this.userMessage.toLowerCase().includes('vulnerabilities') && this.data?.vulnerabilities?.length) {
        // Include all vulnerabilities (with name, severity, summary, and URL)
        const formattedVulns = this.data.vulnerabilities.map((v: { name: any; severity: any; summary: any; url: any; }) =>
          `Package: ${v.name}\nSeverity: ${v.severity}\nSummary: ${v.summary}\nURL: ${v.url}`
        ).join('\n\n');
  
        prompt += `\n\nHere are the vulnerabilities:\n${formattedVulns}`;
      }
  
      this.geminiService.sendMessageToGemini(prompt).subscribe(response => {
        const geminiText = response.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, no response from Gemini.';
        this.chatHistory.push(`Gemini: ${geminiText}`);
        this.userMessage = '';
      });
    }
  }

  closeChat() {
    this.dialogRef.close();  
  }

  // Format Markdown and make sure it's a string (remove async handling)
  formatMarkdown(text: string): SafeHtml {
    const rawHtml = marked.parse(text);
    return this.sanitizer.bypassSecurityTrustHtml(rawHtml.toString());
  }
  
}
