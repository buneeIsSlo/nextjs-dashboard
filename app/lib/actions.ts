'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import {v4 as uuidv4} from 'uuid';

const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer'
    }),
    amount: z.coerce.number().gt(0, { message: 'Please enter an amount greater than $0' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice statement'
    }),
    date: z.string()
})

const CustomerFormSchema = z.object({
    id: z.string(),
    name: z.string().min(2, "Name must have at least 2 characters"),
    email: z.string().regex(emailRegex, {message: "Please enter a valid email"}),
    image_url: z.string(),
})


const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

const AddCustomer = CustomerFormSchema.omit({id: true, image_url: true});
const UpdateCustomer = CustomerFormSchema.omit({id: true, image_url: true});

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

export type CustomerState = {
    errors?: {
        name?:string[];
        email?: string[];
    };
    message?: string | null;
}

export async function createInvoice(prevState: State, formData: FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }

    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    try {
        await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
    } catch (error) {
        return {
            message: 'Database Error: Failed to Create Invoice.',
        };
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function updateInvoice(
    id: string,
    prevState: State,
    formData: FormData,
) {
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Update Invoice.',
        };
    }

    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;

    try {
        await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
    } catch (error) {
        return { message: 'Database Error: Failed to Update Invoice.' };
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath('/dashboard/invoices');
        return { message: 'Deleted Invoice.' };
    } catch (error) {
        return { message: 'Database Error: Failed to Delete Invoice.' };
    }
}

export async function addNewCustomer(prevState: CustomerState, formData: FormData) {
    const validatedFields = AddCustomer.safeParse({
        name: formData.get("name"),
        email: formData.get("email"),
    });

    if(!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: "Missing Fields. Failed to Add Customer",
        };
    }

    const {name, email} = validatedFields.data;
    const id = uuidv4();
    const image_url = '/customers/emil-kowalski.png'; // random image from assets

    try {
        await sql`
        INSERT INTO customers (id, name, email, image_url)
        VALUES (${id}, ${name}, ${email}, ${image_url})
        ON CONFLICT (id) DO NOTHING
        `;
    }
    catch (error) {
        return {
            message: 'Database Error: Failed to Add Customer',
        }
    }

    revalidatePath('/dashboard/customers');
    redirect('/dashboard/customers');
}

export async function updateCustomer(id:string, prevState: CustomerState, formData: FormData) {
    const validatedFields = UpdateCustomer.safeParse({
        name: formData.get("name"),
        email: formData.get("email"),
    });

    if(!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Update Customer.'
        }
    };

    const {name, email} = validatedFields.data;

    try {
        await sql`
        UPDATE customers
        SET name = ${name}, email = ${email}
        WHERE id = ${id}
        `;
    }
    catch (error) {
        return {message: 'Database Error: Failed to Update Customer'};
    }

    revalidatePath('/dashboard/customers');
    redirect('/dashboard/customers');
}

export async function deleteCustomer(id: string) {
    try {
        await sql`DELETE FROM customers WHERE id = ${id}`;
        revalidatePath('/dashboard/customers');
        return { message: 'Deleted Customer' };
    } catch (error) {
        return { message: 'Database Error: Failed to Delete Customer.' };
    }
}

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }
        throw error;
    }
}