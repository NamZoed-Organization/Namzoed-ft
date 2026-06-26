import { fetchModerationQueue, updatePostModerationStatus } from '@/lib/postsService';
import type { ModerationStatus } from '@/types/post';
import { Check, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface ModerationItem {
  id: string;
  content: string;
  content_rating: string;
  moderation_status: string;
  created_at: string;
  profiles?: { name?: string };
}

interface ModerationDashboardProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Admin moderation dashboard component
 * Allows moderators to review and approve/reject pending posts
 * 
 * Usage:
 * ```tsx
 * const [showModeration, setShowModeration] = useState(false);
 * <ModerationDashboard visible={showModeration} onClose={() => setShowModeration(false)} />
 * ```
 */
export const ModerationDashboard: React.FC<ModerationDashboardProps> = ({
  visible,
  onClose,
}) => {
  const [queue, setQueue] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ModerationItem | null>(null);
  const [notes, setNotes] = useState('');
  const [decision, setDecision] = useState<ModerationStatus | null>(null);

  // Load moderation queue
  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchModerationQueue(50);
      setQueue(data);
    } catch (error) {
      console.error('Error loading moderation queue:', error);
      Alert.alert('Error', 'Failed to load moderation queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadQueue();
    }
  }, [visible, loadQueue]);

  const handleReview = (post: ModerationItem) => {
    setSelectedPost(post);
    setNotes('');
    setDecision(null);
  };

  const handleSubmitDecision = async () => {
    if (!selectedPost || !decision) {
      Alert.alert('Error', 'Please select a decision');
      return;
    }

    try {
      await updatePostModerationStatus(selectedPost.id, decision, notes);
      
      // Remove from queue
      setQueue((prev) => prev.filter((p) => p.id !== selectedPost.id));
      setSelectedPost(null);
      
      Alert.alert('Success', `Post ${decision} successfully`);
    } catch (error) {
      console.error('Error updating moderation status:', error);
      Alert.alert('Error', 'Failed to update post status');
    }
  };

  const getContentRatingColor = (rating: string) => {
    switch (rating) {
      case 'sensitive':
        return '#fff3bf';
      case '18_plus':
        return '#f8d7da';
      case 'review_required':
        return '#e7e7ff';
      default:
        return '#f0f0f0';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Moderation Queue</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={styles.statValue}>{queue.length}</Text>
          </View>
        </View>

        {/* Queue List */}
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        ) : queue.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>All posts reviewed!</Text>
            <Text style={styles.emptySubtext}>Come back later for more posts to moderate</Text>
          </View>
        ) : (
          <FlatList
            data={queue}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.queueItem,
                  { backgroundColor: getContentRatingColor(item.content_rating) },
                ]}
                onPress={() => handleReview(item)}
              >
                <View style={styles.queueItemContent}>
                  <View style={styles.contentRatingBadge}>
                    <Text style={styles.ratingText}>{item.content_rating}</Text>
                  </View>
                  <Text style={styles.queueItemAuthor}>
                    {item.profiles?.name || 'Anonymous'}
                  </Text>
                  <Text style={styles.queueItemText} numberOfLines={2}>
                    {item.content}
                  </Text>
                  <Text style={styles.queueItemDate}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContent}
          />
        )}

        {/* Review Modal */}
        <Modal visible={selectedPost !== null} animationType="slide" transparent={true}>
          <View style={styles.reviewOverlay}>
            <View style={styles.reviewCard}>
              {/* Header */}
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewTitle}>Review Post</Text>
                <TouchableOpacity
                  onPress={() => setSelectedPost(null)}
                  style={styles.reviewClose}
                >
                  <X size={24} color="#333" />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <View style={styles.reviewContent}>
                <View style={styles.contentSection}>
                  <Text style={styles.sectionLabel}>Author:</Text>
                  <Text style={styles.sectionValue}>
                    {selectedPost?.profiles?.name || 'Anonymous'}
                  </Text>
                </View>

                <View style={styles.contentSection}>
                  <Text style={styles.sectionLabel}>Rating:</Text>
                  <Text
                    style={[
                      styles.sectionValue,
                      { color: getContentRatingColor(selectedPost?.content_rating || '') },
                    ]}
                  >
                    {selectedPost?.content_rating}
                  </Text>
                </View>

                <View style={styles.contentSection}>
                  <Text style={styles.sectionLabel}>Content:</Text>
                  <Text style={styles.postContent}>{selectedPost?.content}</Text>
                </View>

                {/* Decision Buttons */}
                <View style={styles.decisionSection}>
                  <Text style={styles.sectionLabel}>Decision:</Text>
                  <View style={styles.decisionButtons}>
                    <TouchableOpacity
                      style={[
                        styles.decisionButton,
                        styles.approveButton,
                        decision === 'approved' && styles.decisionButtonActive,
                      ]}
                      onPress={() => setDecision('approved')}
                    >
                      <Check size={20} color="#fff" />
                      <Text style={styles.decisionButtonText}>Approve</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.decisionButton,
                        styles.rejectButton,
                        decision === 'rejected' && styles.decisionButtonActive,
                      ]}
                      onPress={() => setDecision('rejected')}
                    >
                      <X size={20} color="#fff" />
                      <Text style={styles.decisionButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Notes */}
                <View style={styles.notesSection}>
                  <Text style={styles.sectionLabel}>Moderation Notes:</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Add notes (e.g., reason for rejection)..."
                    placeholderTextColor="#999"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                  />
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.reviewActions}>
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleSubmitDecision}
                >
                  <Text style={styles.submitButtonText}>Submit Decision</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  closeButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  listContent: {
    padding: 12,
  },
  queueItem: {
    marginBottom: 8,
    borderRadius: 8,
    padding: 12,
  },
  queueItemContent: {
    gap: 8,
  },
  contentRatingBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  queueItemAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  queueItemText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
  },
  queueItemDate: {
    fontSize: 12,
    color: '#999',
  },
  reviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '90%',
    width: '100%',
    overflow: 'hidden',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  reviewClose: {
    padding: 4,
  },
  reviewContent: {
    padding: 16,
    maxHeight: '70%',
  },
  contentSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  sectionValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  postContent: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  decisionSection: {
    marginVertical: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  decisionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  decisionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#28a745',
  },
  rejectButton: {
    backgroundColor: '#dc3545',
  },
  decisionButtonActive: {
    opacity: 0.8,
  },
  decisionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  notesSection: {
    marginBottom: 16,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  reviewActions: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 16,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default ModerationDashboard;
