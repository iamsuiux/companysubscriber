import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCompanyById, updateCompany, deleteCompany } from '@/lib/db/companies';
import { updateCompanySchema } from '@/lib/utils/validation';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const company = await getCompanyById(params.id);

    if (!company) {
      return NextResponse.json(
        { error: { message: 'Company not found', code: 'NOT_FOUND' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: company });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    console.error('Get company error:', error);
    return NextResponse.json(
      { error: { message: 'Failed to get company', code: 'GET_COMPANY_ERROR' } },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();

    const body = await request.json();
    const result = updateCompanySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: { message: result.error.errors[0].message, code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const company = await updateCompany(params.id, result.data);
    return NextResponse.json({ data: company });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    console.error('Update company error:', error);
    return NextResponse.json(
      { error: { message: 'Failed to update company', code: 'UPDATE_COMPANY_ERROR' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    await deleteCompany(params.id);
    return NextResponse.json({ data: { message: 'Company deleted' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    console.error('Delete company error:', error);
    return NextResponse.json(
      { error: { message: 'Failed to delete company', code: 'DELETE_COMPANY_ERROR' } },
      { status: 500 }
    );
  }
}
