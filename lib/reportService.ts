import { supabase } from './supabase';

export interface UserReport {
  id?: string;
  reporter_id: string;
  target_id: string;
  item_id?: string;
  reason: string;
  details: string;
  status?: string;
  created_at?: string;
}

export type ReportReason = 'inappropriate' | 'scam' | 'harassment' | 'fake' | 'other';

export interface ProductReport {
  reporter_id: string;
  target_id: string;  // Product owner's ID
  item_id: string;    // Product ID
  reason: string;
  details: string;
}

// Submit a user report
export const reportUser = async (
  report: UserReport
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('user_reports')
      .insert({
        reporter_id: report.reporter_id,
        target_id: report.target_id,
        item_id: report.item_id,
        reason: report.reason,
        details: report.details,
        status: 'pending',
        created_at: new Date().toISOString()
      });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error reporting user:', error);
    return { success: false, error: error.message || 'Failed to submit report' };
  }
};

// Check if user has already reported target
export const hasReportedUser = async (
  reporterId: string,
  targetId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('user_reports')
      .select('id')
      .eq('reporter_id', reporterId)
      .eq('target_id', targetId)
      .maybeSingle();

    if (error) {
      console.error('Error checking report status:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in hasReportedUser:', error);
    return false;
  }
};

// Submit a product report
export const reportProduct = async (
  report: ProductReport
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('user_reports')
      .insert({
        reporter_id: report.reporter_id,
        target_id: report.target_id,
        item_id: report.item_id,
        reason: report.reason,
        details: report.details,
        status: 'pending',
        created_at: new Date().toISOString()
      });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error reporting product:', error);
    return { success: false, error: error.message || 'Failed to submit report' };
  }
};

export interface PostReport {
  reporter_id: string;
  target_id: string;  // Post owner's ID
  item_id: string;    // Post ID
  reason: string;
  details: string;
}

// Submit a post report
export const reportPost = async (
  report: PostReport
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('user_reports')
      .insert({
        reporter_id: report.reporter_id,
        target_id: report.target_id,
        item_id: report.item_id,
        reason: report.reason,
        details: report.details,
        status: 'pending',
        created_at: new Date().toISOString()
      });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error reporting post:', error);
    return { success: false, error: error.message || 'Failed to submit report' };
  }
};
