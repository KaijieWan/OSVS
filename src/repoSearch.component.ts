import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { GitHubService } from './github.service';
import { CommonModule } from '@angular/common';
import { AfterViewInit, ElementRef, HostListener, Injectable, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { ChatModalComponent } from './chat-modal.component';
import { MatDialog } from '@angular/material/dialog';
import { github_token } from '../public/environment';


@Component({
  selector: 'app-repo-search',
  templateUrl: './repoSearch.component.html',
  styleUrls: ['./repoSearch.component.scss'],

  imports: [CommonModule, FormsModule],
})
export class RepoSearchComponent implements OnInit {
  searchResults: any;
  isLoading: boolean = false;
  repoUrl: string = "";
  errorMessage: string = "";
  dependencies: any[] = [];
  token: string = github_token;

  constructor(private githubService: GitHubService, private cdr: ChangeDetectorRef, private dialog: MatDialog) {}

  ngOnInit() {}

  onSearch() {
    this.isLoading = true;
  
    const repoDetails = this.extractRepoDetails(this.repoUrl);
    if (!repoDetails) {
      this.errorMessage = 'Invalid GitHub repository URL.';
      return;
    }
  
    this.githubService.getDependencies(repoDetails.owner, repoDetails.repo, this.token).subscribe({
      next: async ({ fileType, dependencies }) => {
        console.log(`Found dependency file: ${fileType}`);
        console.log("Dependencies unprocessed: " + dependencies);
  
        this.dependencies = dependencies.map(dep => {
          const parts = dep.split(':');
          return { name: parts[0], version: parts[1] || 'Unknown', latestVersion: 'N/A' };
        });
  
        console.log('Extracted Dependencies:', dependencies);
  
        switch (fileType) {
          case 'package.json':
            this.dependencies = await Promise.all(
              this.dependencies.map(async (dependency) => {
                const latestVersion = await this.getLatestVersion(dependency.name, 'npm');
                return { ...dependency, latestVersion };
              })
            );
            break;
          case 'requirements.txt':
            this.dependencies = await Promise.all(
              this.dependencies.map(async (dependency) => {
                const latestVersion = await this.getLatestVersion(dependency.name, 'pypi');
                return { ...dependency, latestVersion };
              })
            );
            break;
          case 'pom.xml':
          case 'build.gradle':
            this.dependencies = await Promise.all(
              this.dependencies.map(async (dependency) => {
                const latestVersion = await this.getLatestVersion(dependency.name, 'maven');
                return { ...dependency, latestVersion };
              })
            );
            break;
          default:
            console.error('Unsupported dependency file type');
        }
  
        this.githubService.getDependencyVulnerabilities(repoDetails.owner, repoDetails.repo, this.token).subscribe({
          next: async (response) => {
            console.log(response);
  
            this.dependencies = await this.dependencies.map(dep => {
              const vuln = response.find((v: { dependency: { package: { name: any; }; }; }) =>
                v.dependency.package.name === dep.name
              );
              return vuln
                ? {
                    ...dep,
                    severity: vuln.security_vulnerability.severity,
                    summary: vuln.security_advisory.summary,
                    url: vuln.html_url
                  }
                : dep;
            });        
  
            console.log(this.dependencies);
            this.isLoading = false;
          },
          error: (err) => {
            console.error('Vulnerability fetch error:', err);
            this.errorMessage = err;
            this.isLoading = false;
          }
        });
      },
      error: (err) => {
        console.error('Error:', err);
        this.isLoading = false;
      }
    });
  }

  async getLatestVersion(packageName: string, packageType: string): Promise<string> {
    return firstValueFrom(this.githubService.checkLatestVersion(packageName, packageType));
  }

  /*getLatestVersion(packageName: string, packageType: string) {
    this.githubService.checkLatestVersion(packageName ,packageType).subscribe({
      next: (response) => {
        console.log(response);
      }
    })
  }*/

  extractRepoDetails(repoUrl: string): { owner: string; repo: string } | null {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
    return null;
  }

  parsePackageJson(jsonContent: string): string[] {
    const parsed = JSON.parse(jsonContent);
    return Object.keys(parsed.dependencies || {});
  }

  parseRequirementsTxt(txtContent: string): string[] {
    return txtContent.split('\n').map(line => line.split('==')[0]).filter(Boolean);
  }

  parsePomXml(xmlContent: string): string[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
    const dependencies = xmlDoc.getElementsByTagName('dependency');
  
    return Array.from(dependencies).map(dep => {
      const groupId = dep.getElementsByTagName('groupId')[0]?.textContent || '';
      const artifactId = dep.getElementsByTagName('artifactId')[0]?.textContent || '';
      return `${groupId}:${artifactId}`;
    });
  }

  parseGradle(gradleContent: string): string[] {
    return gradleContent
      .split('\n')
      .filter(line => line.includes('implementation') || line.includes('api'))
      .map(line => line.replace(/.*['"]([^'"]+)['"].*/, '$1').trim());
  }
  
  openChatModal() {
    const vulnerabilitySummaries = this.dependencies.map(dep => ({
      name: dep.name,
      severity: dep.severity,
      summary: dep.summary,
      url: dep.url
    }));
    const dialogRef = this.dialog.open(ChatModalComponent, {
      //width: '3000px',  // You can adjust the modal size
      data: {
        vulnerabilities: this.dependencies,
        dependencies: this.dependencies,
      },
      width: '90vw',
      height: '90vh',
      maxWidth: '90vw',
    });
  }  

  closeDetails(){

  }
}