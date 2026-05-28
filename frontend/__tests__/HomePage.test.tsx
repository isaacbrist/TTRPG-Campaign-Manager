/**
 * Tests for the Home page (campaign list).
 *
 * The API module is mocked so no real backend is needed.
 * The component is wrapped in a minimal Toast context so useToast() works.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// ── Mocks — must be declared before any imports that use them ──────────────

// jest.mock factory closures can only reference variables prefixed with "mock"
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock('@/lib/api', () => ({
  getCampaigns:   jest.fn(),
  createCampaign: jest.fn(),
  updateCampaign: jest.fn(),
  deleteCampaign: jest.fn(),
}));

jest.mock('@/components/Toast', () => ({
  useToast: () => mockToast,
}));

// ── Imports that rely on the mocks above ───────────────────────────────────

import * as api from '@/lib/api';
import HomePage from '@/app/page';

const mockGetCampaigns   = api.getCampaigns   as jest.MockedFunction<typeof api.getCampaigns>;
const mockCreateCampaign = api.createCampaign as jest.MockedFunction<typeof api.createCampaign>;

function makeCampaign(id: number, name: string) {
  return {
    id,
    name,
    description: `Description for ${name}`,
    setting: 'Homebrew',
    createdAt: '2025-01-01T00:00:00Z',
    npcs: [],
    sessions: [],
  };
}

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe('HomePage', () => {
  test('renders "Your Campaigns" heading and "+ New Campaign" button', async () => {
    mockGetCampaigns.mockResolvedValue([]);

    render(<HomePage />);

    expect(screen.getByText('Your Campaigns')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new campaign/i })).toBeInTheDocument();

    await waitFor(() => expect(mockGetCampaigns).toHaveBeenCalledTimes(1));
  });

  test('shows campaign names once the API responds', async () => {
    mockGetCampaigns.mockResolvedValue([
      makeCampaign(1, 'Curse of Strahd'),
      makeCampaign(2, 'Tomb of Annihilation'),
    ]);

    render(<HomePage />);

    expect(await screen.findByText('Curse of Strahd')).toBeInTheDocument();
    expect(await screen.findByText('Tomb of Annihilation')).toBeInTheDocument();
  });

  test('shows empty state message when there are no campaigns', async () => {
    mockGetCampaigns.mockResolvedValue([]);

    render(<HomePage />);

    expect(await screen.findByText(/no campaigns yet/i)).toBeInTheDocument();
  });

  test('calls toast.error when getCampaigns fails', async () => {
    mockGetCampaigns.mockRejectedValue(new Error('Network error'));

    render(<HomePage />);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed to load campaigns.');
    });
  });

  test('clicking "+ New Campaign" opens the create form', async () => {
    const user = userEvent.setup();
    mockGetCampaigns.mockResolvedValue([]);

    render(<HomePage />);
    await waitFor(() => expect(mockGetCampaigns).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: /new campaign/i }));

    // The modal should now be visible with a name input and a Create button
    expect(await screen.findByPlaceholderText(/campaign name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^create$/i })).toBeInTheDocument();
  });

  test('submitting the create form calls createCampaign and shows success toast', async () => {
    const user = userEvent.setup();
    mockGetCampaigns.mockResolvedValue([]);
    mockCreateCampaign.mockResolvedValue(makeCampaign(5, 'Dragon Heist'));

    render(<HomePage />);
    await waitFor(() => expect(mockGetCampaigns).toHaveBeenCalledTimes(1));

    // Open the modal
    await user.click(screen.getByRole('button', { name: /new campaign/i }));

    // Type a name and submit
    const nameInput = await screen.findByPlaceholderText(/campaign name/i);
    await user.type(nameInput, 'Dragon Heist');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(mockCreateCampaign).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Dragon Heist' })
      );
    });
    expect(mockToast.success).toHaveBeenCalledWith('"Dragon Heist" created.');
  });
});
