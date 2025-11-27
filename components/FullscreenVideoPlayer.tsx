import { Heart, MessageCircle, Share2, X } from "lucide-react-native";
import React from "react";
import {
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

interface FullscreenVideoPlayerProps {
  visible: boolean;
  videoUri: string;
  videoId: string;
  onClose: () => void;
  postContent?: string;
  username?: string;
  likes?: number;
  comments?: number;
}

export default function FullscreenVideoPlayer({
  visible,
  videoUri,
  videoId,
  onClose,
  postContent,
  username,
  likes = 0,
  comments = 0,
}: FullscreenVideoPlayerProps) {

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <StatusBar hidden />
      <View style={styles.container}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
          <X size={28} color="#fff" />
        </TouchableOpacity>

        <View style={styles.videoWrapper}>
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderTitle}>Video Playback</Text>
            <Text style={styles.placeholderText}>Coming Soon</Text>
            <Text style={styles.placeholderSubtext}>Video functionality is being updated</Text>
          </View>
        </View>

        <View style={styles.bottomSection}>
          {postContent && (
            <View style={styles.postContentBox}>
              {username && <Text style={styles.usernameText}>{username}</Text>}
              <Text style={styles.contentText}>{postContent}</Text>
            </View>
          )}
          <View style={styles.actionStrip}>
            <TouchableOpacity style={styles.actionButton}>
              <Heart size={20} color="white" />
              <Text style={styles.actionText}>{likes > 0 ? likes : 'Like'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <MessageCircle size={20} color="white" />
              <Text style={styles.actionText}>{comments > 0 ? comments : 'Comment'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Share2 size={20} color="white" />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    zIndex: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 50,
    padding: 8
  },
  videoWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  placeholderTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  placeholderText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 8,
  },
  placeholderSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingBottom: 20
  },
  postContentBox: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 8
  },
  usernameText: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 4
  },
  contentText: {
    color: '#fff'
  },
  actionStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.6)'
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  actionText: {
    color: '#fff',
    fontSize: 12
  },
});