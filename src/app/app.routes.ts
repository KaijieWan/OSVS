import { Routes } from '@angular/router';
import { RepoSearchComponent } from '../repoSearch.component';

export const routes: Routes = [
    { path: 'repoSearch', component: RepoSearchComponent },
    { path: '', redirectTo: '/repoSearch', pathMatch: 'full' },
];
