import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import {
  OktaAuthModule,
  OktaAuthService,
  OktaAuthGuard,
  OktaConfig,
  OKTA_CONFIG,
} from '../../src/okta-angular';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router, RouterState } from '@angular/router';
import { Injector } from '@angular/core';
import { OktaAuth } from '@okta/okta-auth-js';

const VALID_CONFIG = {
  clientId: 'foo',
  issuer: 'https://foo',
  redirectUri: 'https://foo'
};

function createService(config: OktaConfig) {
  config = config || {};

  TestBed.configureTestingModule({
    imports: [
      RouterTestingModule.withRoutes([{ path: 'foo', redirectTo: '/foo' }]),
      OktaAuthModule
    ],
    providers: [
      OktaAuthService,
      {
        provide: OKTA_CONFIG,
        useValue: Object.assign({}, VALID_CONFIG, config)
      },
    ],
  });
  const service = TestBed.inject(OktaAuthService);
  service.setOriginalUri = jest.fn();
  service.signInWithRedirect = jest.fn();
  return service;
}

describe('Angular auth guard', () => {

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('canActivate', () => {
    describe('isAuthenticated() = true', () => {
      it('returns true', async () => {
        const service = createService({ isAuthenticated: () => Promise.resolve(true) });
        const injector: Injector = TestBed.inject(Injector);
        const guard = new OktaAuthGuard(service, injector as Injector);
        const route: unknown = undefined;
        const state: unknown = undefined;
        const res = await guard.canActivate(route as ActivatedRouteSnapshot, state as RouterStateSnapshot);
        expect(res).toBe(true);
      });
    });

    describe('isAuthenticated() = false', () => {
      let service: OktaAuthService;
      let guard: OktaAuthGuard;
      let state: RouterStateSnapshot;
      let route: ActivatedRouteSnapshot;
      let router: Router;
      let injector: Injector;
      beforeEach(() => {
        service = createService({ isAuthenticated: () => Promise.resolve(false) });
        router = TestBed.inject(Router);
        injector = TestBed.inject(Injector);
        guard = new OktaAuthGuard(service, injector);
        const routerState: RouterState = router.routerState;
        state = routerState.snapshot;
        route = state.root;
      });

      it('returns false', async () => {
        const res = await guard.canActivate(route, state);
        expect(res).toBe(false);
      });

      it('by default, calls "signInWithRedirect()"', async () => {
        await guard.canActivate(route, state);
        expect(service.signInWithRedirect).toHaveBeenCalled();
      });

      it('calls "setOriginalUri" with state url', async () => {
        const baseUrl = 'http://fake.url/path';
        const query = '?query=foo&bar=baz';
        const hash = '#hash=foo';
        state.url = `${baseUrl}${query}${hash}`;
        const queryObj = { 'bar': 'baz' };
        route.queryParams = queryObj;
        await guard.canActivate(route, state);
        expect(service.setOriginalUri).toHaveBeenCalledWith(state.url);
      });

      it('onAuthRequired can be set on route', async () => {
        const fn = route.data['onAuthRequired'] = jest.fn();
        await guard.canActivate(route, state);
        expect(fn).toHaveBeenCalledWith(service, injector);
      });

      it('onAuthRequired can be set on config', async () => {
        const config = service.getOktaConfig();
        const fn = config.onAuthRequired = jest.fn();

        await guard.canActivate(route, state);
        expect(fn).toHaveBeenCalledWith(service, injector);
      });
    });
  });

  describe('canActivateChild', () => {
    it('calls canActivate', () => {
      const service = createService({ isAuthenticated: () => Promise.resolve(false) });
      const injector = TestBed.inject(Injector);
      const guard = new OktaAuthGuard(service, injector);
      const router = TestBed.inject(Router);
      const routerState: RouterState = router.routerState;
      const state = routerState.snapshot;
      const route = state.root;

      jest.spyOn(guard, 'canActivate').mockReturnValue(Promise.resolve(true));
      guard.canActivateChild(route, state);
      expect(guard.canActivate).toHaveBeenCalledWith(route, state);
    });
  });

  it('Can create the guard via angular injection', () => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([{ path: 'foo', redirectTo: '/foo' }]),
        OktaAuthModule
      ],
      providers: [
        OktaAuthService,
        OktaAuthGuard,
        {
          provide: OKTA_CONFIG,
          useValue: VALID_CONFIG
        },
      ],
    });
    const guard = TestBed.inject(OktaAuthGuard) as unknown as {oktaAuth: OktaAuth, injector: Injector, canActivate: () => boolean};
    expect(guard.oktaAuth).toBeTruthy();
    expect(guard.injector).toBeTruthy();
    expect(typeof guard.canActivate).toBe('function');
  });
});
