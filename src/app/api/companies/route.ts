import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAllCompanies, createCompany } from '@/lib/db/companies';
import { createCompanySchema } from '@/lib/utils/validation';

export async function GET() {
  try {
    await requireAuth();
    const companies = await getAllCompanies();
    return NextResponse.json({ data: companies });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    console.error('Get companies error:', error);
    return NextResponse.json(
      { error: { message: 'Failed to get companies', code: 'GET_COMPANIES_ERROR' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const result = createCompanySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: { message: result.error.errors[0].message, code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const company = await createCompany(result.data.name, result.data.career_page_url);
    return NextResponse.json({ data: company }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    console.error('Create company error:', error);
    return NextResponse.json(
      { error: { message: 'Failed to create company', code: 'CREATE_COMPANY_ERROR' } },
      { status: 500 }
    );
  }
}
