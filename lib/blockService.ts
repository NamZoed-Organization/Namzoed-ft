import { supabase } from './supabase';

export interface UserBlock {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

// Check if current user has blocked target user
export const isUserBlocked = async (
  blockerId: string,
  blockedId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId)
      .maybeSingle();

    if (error) {
      console.error('Error checking block status:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in isUserBlocked:', error);
    return false;
  }
};

// Block a user and clean up all social ties
export const blockUser = async (
  blockerId: string,
  blockedId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Call the SQL function via RPC
    const { error } = await supabase.rpc('block_and_clean', {
      blocker_uuid: blockerId,
      target_uuid: blockedId
    });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error blocking user:', error);
    return { success: false, error: error.message || 'Failed to block user' };
  }
};

// Unblock a user
export const unblockUser = async (
  blockerId: string,
  blockedId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error unblocking user:', error);
    return { success: false, error: error.message || 'Failed to unblock user' };
  }
};

// Get list of blocked user IDs
export const getBlockedUsers = async (
  userId: string
): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', userId);

    if (error) throw error;
    return (data || []).map(row => row.blocked_id);
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    return [];
  }
};
