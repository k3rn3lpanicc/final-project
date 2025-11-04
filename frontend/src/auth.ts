import axios from 'axios';

const API_BASE_URL = 'https://votingbackend.emit-aut.ir';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: string;
  role: string;
}

class AuthService {
  private static ACCESS_TOKEN_KEY = 'user_access_token';
  private static REFRESH_TOKEN_KEY = 'user_refresh_token';
  private static USER_ROLE_KEY = 'user_role';

  async register(email: string, password: string): Promise<AuthTokens> {
    const response = await axios.post<AuthTokens>(
      `${API_BASE_URL}/auth/user/register`,
      { email, password }
    );
    this.setTokens(response.data);
    return response.data;
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const response = await axios.post<AuthTokens>(
      `${API_BASE_URL}/auth/user/login`,
      { email, password }
    );
    this.setTokens(response.data);
    return response.data;
  }

  async refreshAccessToken(): Promise<string> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await axios.post<{ access_token: string; expires_in: string }>(
      `${API_BASE_URL}/auth/refresh`,
      { refresh_token: refreshToken }
    );

    localStorage.setItem(AuthService.ACCESS_TOKEN_KEY, response.data.access_token);
    return response.data.access_token;
  }

  async logout(): Promise<void> {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      try {
        await axios.post(`${API_BASE_URL}/auth/logout`, {
          refresh_token: refreshToken,
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    this.clearTokens();
  }

  setTokens(tokens: AuthTokens): void {
    localStorage.setItem(AuthService.ACCESS_TOKEN_KEY, tokens.access_token);
    localStorage.setItem(AuthService.REFRESH_TOKEN_KEY, tokens.refresh_token);
    localStorage.setItem(AuthService.USER_ROLE_KEY, tokens.role);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(AuthService.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(AuthService.REFRESH_TOKEN_KEY);
  }

  getUserRole(): string | null {
    return localStorage.getItem(AuthService.USER_ROLE_KEY);
  }

  clearTokens(): void {
    localStorage.removeItem(AuthService.ACCESS_TOKEN_KEY);
    localStorage.removeItem(AuthService.REFRESH_TOKEN_KEY);
    localStorage.removeItem(AuthService.USER_ROLE_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken() && this.getUserRole() === 'user';
  }
}

export const authService = new AuthService();
