// Utility for making authenticated API requests with JWT
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  // Get the JWT token from localStorage or sessionStorage
  const token = localStorage.getItem('jwt_token') || sessionStorage.getItem('jwt_token');
  
  // If we have a token, add it to the Authorization header
  if (token) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  const response = await fetch(url, options);
  
  // If unauthorized, clear the token and redirect to sign-in
  if (response.status === 401) {
    localStorage.removeItem('jwt_token');
    sessionStorage.removeItem('jwt_token');
    window.location.href = '/sign-in';
    throw new Error('Unauthorized');
  }

  return response;
}

// Function to get a new JWT token from the server
export async function getAuthToken() {
  try {
    const response = await fetch('/api/auth/token', {
      method: 'GET',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to get auth token');
    }
    
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    throw error;
  }
}

// Store the JWT token in the browser
export function storeToken(token: string, rememberMe: boolean = false) {
  if (rememberMe) {
    localStorage.setItem('jwt_token', token);
  } else {
    sessionStorage.setItem('jwt_token', token);
  }
}

// Clear the stored JWT token
export function clearToken() {
  localStorage.removeItem('jwt_token');
  sessionStorage.removeItem('jwt_token');
}
