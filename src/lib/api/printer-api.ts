import { PrinterJob } from '@/types/pdv';
import { createClient } from '../supabase/client';
import { getBusinessDayRange } from '../utils/business-day';

export const printerApi = {
  getTodayJobs: async (): Promise<PrinterJob[]> => {
    const supabase = createClient();

    const { start, end } = getBusinessDayRange();

    const { data, error } = await supabase
      .from('printer_jobs')
      .select(`
        *,
        order:orders(
          daily_number,
          status,
          payment_status,
          total_amount,
          customer_name
        )
      `)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }
};
