import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from '@/components/tables/DataTable';

type Row = { id: string; name: string };

describe('DataTable', () => {
  const columns = [
    { id: 'name', header: 'Name', cell: (row: Row) => row.name },
  ];

  it('renders rows and supports row click', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={[
          { id: '1', name: 'Alpha' },
          { id: '2', name: 'Beta' },
        ]}
        rowKey={(row) => row.id}
        onRowClick={onRowClick}
      />,
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    await user.click(screen.getByText('Beta'));
    expect(onRowClick).toHaveBeenCalledWith({ id: '2', name: 'Beta' });
  });

  it('shows empty and error states', () => {
    const { rerender } = render(
      <DataTable columns={columns} rows={[]} rowKey={(row) => row.id} emptyTitle="No rows" />,
    );
    expect(screen.getByText('No rows')).toBeInTheDocument();

    rerender(
      <DataTable
        columns={columns}
        rows={[]}
        rowKey={(row) => row.id}
        error="Boom"
        onRetry={() => undefined}
      />,
    );
    expect(screen.getByText('Boom')).toBeInTheDocument();
  });
});
