/**
 * Tests for src/app/not-found.tsx — the global 404 page.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import NotFound from '@/app/not-found';

describe('NotFound page', () => {
  it('renders the 404 heading', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders "Page Not Found" subtitle', () => {
    render(<NotFound />);
    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });

  it('renders the "Back to Dashboard" link pointing to "/"', () => {
    render(<NotFound />);
    const links = screen.getAllByText('Back to Dashboard');
    const homeLink = links[0].closest('a');
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('renders the search input placeholder', () => {
    render(<NotFound />);
    expect(screen.getByPlaceholderText('Search Shiora...')).toBeInTheDocument();
  });

  it('renders all suggested navigation links', () => {
    render(<NotFound />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Health Records')).toBeInTheDocument();
    expect(screen.getByText('AI Insights')).toBeInTheDocument();
    expect(screen.getByText('Access Control')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders suggested link hrefs correctly', () => {
    render(<NotFound />);

    const recordsLink = screen.getByText('Health Records').closest('a');
    expect(recordsLink).toHaveAttribute('href', '/records');

    const accessLink = screen.getByText('Access Control').closest('a');
    expect(accessLink).toHaveAttribute('href', '/access');
  });

  it('renders Shiora branding footer', () => {
    render(<NotFound />);
    expect(screen.getByText('Shiora on Aethelred')).toBeInTheDocument();
  });
});
