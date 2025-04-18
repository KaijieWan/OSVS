import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, forkJoin, map, Observable, of, switchMap, throwError } from 'rxjs';
import { SNYK_API_KEY } from '../public/environment';

@Injectable({
  providedIn: 'root',
})
export class GitHubService {
  private githubApiUrl = 'https://api.github.com/search/code';

  constructor(private http: HttpClient) {}

  searchRepositories(query: string): Observable<any> {
    const url = `${this.githubApiUrl}?q=${query}`;
    return this.http.get<any>(url);
  }

  // Get package.json file to extract dependencies
  getPackageJson(owner: string, repo: string): Observable<any> {
    const url = `${this.githubApiUrl}/repos/${owner}/${repo}/contents/package.json`;
    return this.http.get(url);
  }

  // Get vulnerability alerts (Requires GitHub authentication for private repos)
  getVulnerabilities(owner: string, repo: string, token: string): Observable<any> {
    const url = `${this.githubApiUrl}/repos/${owner}/${repo}/vulnerability-alerts`;
    const headers = new HttpHeaders({
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.dorian-preview+json', // Required for security advisories
    });
    return this.http.get(url, { headers });
  }

  getDependencies(owner: string, repo: string, token: string): Observable<{ fileType: string, dependencies: string[] }> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/`;
    const headers = new HttpHeaders({
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    });
  
    return this.http.get(url, { headers }).pipe(
      map((files: any) => {
        const supportedFiles = ['package.json', 'requirements.txt', 'pom.xml', 'build.gradle'];
        const file = files.find((f: { name: string }) => supportedFiles.includes(f.name));
  
        if (!file) {
          throw new Error('No dependency file found');
        }
  
        return { fileType: file.name, fileUrl: file.download_url };  // Use download_url
      }),
      switchMap(({ fileType, fileUrl }) =>
        this.http.get(fileUrl, { responseType: 'text' }).pipe(  // No headers needed here
          map((response: string) => {
            let dependencies: string[] = [];
  
            if (fileType === 'package.json') {
              const jsonContent = JSON.parse(response);
              dependencies = Object.entries(jsonContent.dependencies || {}).map(
                ([name, version]) => `${name}:${version}`
              );
            }
            else if (fileType === 'requirements.txt') {
              dependencies = response.split('\n')
                .map(line => line.trim())
                .filter(line => line !== '' && !line.startsWith('#')) // Ignore comments
                .map(line => {
                  const parts = line.split(/[=<>!~]+/);
                  return parts.length > 1 ? `${parts[0]}:${parts[1]}` : parts[0];
                });
            }
            else if (fileType === 'pom.xml') {
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(response, 'text/xml');
              dependencies = Array.from(xmlDoc.getElementsByTagName('dependency')).map(dep => {
                const artifactId = dep.getElementsByTagName('artifactId')[0]?.textContent || '';
                const version = dep.getElementsByTagName('version')[0]?.textContent || '';
                return `${artifactId}:${version}`;
              }).filter(dep => dep !== ''); 
            } 
            else if (fileType === 'build.gradle') {
              const regex = /(?:classpath|implementation|api|compile|testImplementation)\s+['"]([^:]+):([^:]+):([^'"]+)['"]/g;
              let match;
              while ((match = regex.exec(response)) !== null) {
                dependencies.push(`${match[1]}:${match[2]}:${match[3]}`);
              }
            }
  
            return { fileType, dependencies };
          })
        )
      )
    );
  }

  getDependencyVulnerabilities(owner: string, repo: string, token: string): Observable<any> {
    const url = `https://api.github.com/repos/${owner}/${repo}/dependabot/alerts`;
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    });

    return this.http.get(url, { headers }).pipe(
      catchError(error => {
        if (error.status === 403 || error.status === 404) {
          return of({ 
            error: true, 
            message: 'Dependabot alerts are not enabled for this repository or access is restricted.' 
          });
        }
        return throwError(() => error);
      })
    );
  }

  // Check vulnerabilities (Using Snyk API)
  checkDependencyVulnerabilities(dependency: string, version: string): Observable<any> {
    const snykApiUrl = `/snyk/api/v1/vuln/npm/${dependency}@${version}`;
    const snykHeaders = new HttpHeaders({
      Authorization: `token YOUR_SNYK_API_KEY`,
      Accept: 'application/json',
    });
    return this.http.get(snykApiUrl, { headers: snykHeaders });
  }

  // Check vulnerabilities for multiple dependencies
  /*checkAllDependenciesVulnerabilities(dependencies: any): Observable<any[]> {
    const requests = Object.entries(dependencies).map(([dependency, version]) =>
      this.checkDependencyVulnerabilities(dependency, version)
    );
    return forkJoin(requests);
  }*/

    checkLatestVersion(packageName: string, packageType: string): Observable<string> {
      let apiUrl = '';
    
      switch (packageType) {
        case 'npm':
          apiUrl = `https://registry.npmjs.org/${packageName}/latest`;
          break;
        case 'pypi':
          apiUrl = `https://pypi.org/pypi/${packageName}/json`;
          break;
        case 'maven':
          console.log(packageName);
          const [groupId, artifactId] = packageName.split(':');
          apiUrl = `/maven/solrsearch/select`
          + `?q=g:${groupId}+AND+a:${artifactId}`
          + `&rows=1&wt=json`;
          break;
      }
    
      return this.http.get<any>(apiUrl).pipe(
        map(response => {
          //console.log(response);
          if (packageType === 'npm') return response.version;
          if (packageType === 'pypi') return response.info.version;
          if (packageType === 'maven') return response.response.docs[0]?.latestVersion || 'Unknown';
          return 'Unknown';
        })
      );
    }
    
    // Check vulnerabilities (Using Snyk API)
    fineCheckVulnerabilities(dependency: string, version: string): Observable<any> {
    const snykApiUrl = `https://snyk.io/api/v1/vuln/npm/${dependency}@${version}`;
    const snykHeaders = new HttpHeaders({
      Authorization: `token ${SNYK_API_KEY}`,
      Accept: 'application/json',
    });
    return this.http.get(snykApiUrl, { headers: snykHeaders });
  }
}