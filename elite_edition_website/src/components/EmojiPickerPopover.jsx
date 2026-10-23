import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Clock, Smile, ThumbsUp, Heart, Briefcase, AlertCircle, Coffee, Compass, Sparkles } from 'lucide-react';

const EMOJI_CATEGORIES = [
  {
    id: 'recent',
    name: 'Frequently Used',
    icon: Clock,
    emojis: [] // dynamically populated from localStorage / defaults
  },
  {
    id: 'smileys',
    name: 'Smileys & Emotion',
    icon: Smile,
    emojis: [
      { char: '😀', name: 'Grinning Face', tags: ['smile', 'happy', 'grin'] },
      { char: '😃', name: 'Smiling Face with Big Eyes', tags: ['happy', 'joy', 'smile'] },
      { char: '😄', name: 'Smiling Face with Smiling Eyes', tags: ['happy', 'laugh', 'pleased'] },
      { char: '😁', name: 'Beaming Face with Smiling Eyes', tags: ['grin', 'smile', 'cheerful'] },
      { char: '😆', name: 'Grinning Squinting Face', tags: ['laugh', 'happy', 'haha'] },
      { char: '😅', name: 'Grinning Face with Sweat', tags: ['hot', 'phew', 'relief', 'nervous'] },
      { char: '🤣', name: 'Rolling on the Floor Laughing', tags: ['rofl', 'lol', 'laughing'] },
      { char: '😂', name: 'Face with Tears of Joy', tags: ['crying', 'laugh', 'lol', 'tears'] },
      { char: '🙂', name: 'Slightly Smiling Face', tags: ['smile', 'polite', 'calm'] },
      { char: '🙃', name: 'Upside-Down Face', tags: ['silly', 'sarcasm', 'irony'] },
      { char: '😉', name: 'Winking Face', tags: ['wink', 'flirt', 'joke'] },
      { char: '😊', name: 'Smiling Face with Smiling Eyes', tags: ['blush', 'proud', 'warm'] },
      { char: '😇', name: 'Smiling Face with Halo', tags: ['angel', 'innocent', 'good'] },
      { char: '🥰', name: 'Smiling Face with Hearts', tags: ['love', 'adore', 'sweet'] },
      { char: '😍', name: 'Heart Eyes', tags: ['love', 'crush', 'gorgeous'] },
      { char: '🤩', name: 'Star-Struck', tags: ['star', 'wow', 'excited', 'amazed'] },
      { char: '😘', name: 'Face Blowing a Kiss', tags: ['kiss', 'love', 'affection'] },
      { char: '😗', name: 'Kissing Face', tags: ['kiss', 'whistle'] },
      { char: '😚', name: 'Kissing Face with Closed Eyes', tags: ['kiss', 'sweet', 'gentle'] },
      { char: '😙', name: 'Kissing Face with Smiling Eyes', tags: ['kiss', 'smile'] },
      { char: '😋', name: 'Face Savoring Food', tags: ['delicious', 'yummy', 'tasty'] },
      { char: '😛', name: 'Face with Tongue', tags: ['playful', 'silly', 'tease'] },
      { char: '😜', name: 'Winking Face with Tongue', tags: ['crazy', 'wink', 'party'] },
      { char: '🤪', name: 'Zany Face', tags: ['crazy', 'wild', 'goofy'] },
      { char: '😝', name: 'Squinting Face with Tongue', tags: ['playful', 'prank'] },
      { char: '🤑', name: 'Money-Mouth Face', tags: ['money', 'rich', 'cash', 'dollar'] },
      { char: '🤗', name: 'Smiling Face with Open Hands', tags: ['hug', 'welcome', 'embrace'] },
      { char: '🤭', name: 'Face with Hand Over Mouth', tags: ['oops', 'giggle', 'secret'] },
      { char: '🤫', name: 'Shushing Face', tags: ['quiet', 'shh', 'secret', 'silence'] },
      { char: '🤔', name: 'Thinking Face', tags: ['think', 'ponder', 'wonder', 'hmm'] },
      { char: '🤐', name: 'Zipper-Mouth Face', tags: ['silent', 'zip', 'secret'] },
      { char: '🤨', name: 'Face with Raised Eyebrow', tags: ['skeptical', 'doubt', 'suspicious'] },
      { char: '😐', name: 'Neutral Face', tags: ['neutral', 'blank', 'meh'] },
      { char: '😑', name: 'Expressionless Face', tags: ['deadpan', 'unimpressed'] },
      { char: '😶', name: 'Face Without Mouth', tags: ['speechless', 'silent'] },
      { char: '😏', name: 'Smirking Face', tags: ['smirk', 'sly', 'flirt'] },
      { char: '😒', name: 'Unamused Face', tags: ['bored', 'annoyed', 'grumpy'] },
      { char: '🙄', name: 'Face with Rolling Eyes', tags: ['eye roll', 'whatever', 'annoyed'] },
      { char: '😬', name: 'Grimacing Face', tags: ['awkward', 'nervous', 'yikes'] },
      { char: '🤥', name: 'Lying Face', tags: ['liar', 'pinocchio'] },
      { char: '😌', name: 'Relieved Face', tags: ['calm', 'peaceful', 'relax'] },
      { char: '😔', name: 'Pensive Face', tags: ['sad', 'thoughtful', 'regret'] },
      { char: '😪', name: 'Sleepy Face', tags: ['tired', 'sleep', 'snooze'] },
      { char: '🤤', name: 'Drooling Face', tags: ['drool', 'craving'] },
      { char: '😴', name: 'Sleeping Face', tags: ['sleep', 'zzz', 'night'] },
      { char: '😷', name: 'Face with Medical Mask', tags: ['mask', 'sick', 'virus'] },
      { char: '🤒', name: 'Face with Thermometer', tags: ['fever', 'ill', 'sick'] },
      { char: '🤕', name: 'Face with Head-Bandage', tags: ['hurt', 'injury', 'ouch'] },
      { char: '🤢', name: 'Nauseated Face', tags: ['gross', 'disgust', 'sick'] },
      { char: '🤮', name: 'Face Vomiting', tags: ['throw up', 'gross', 'barf'] },
      { char: '🤧', name: 'Sneezing Face', tags: ['sneeze', 'cold', 'flu'] },
      { char: '🥵', name: 'Hot Face', tags: ['heat', 'sweat', 'summer', 'spicy'] },
      { char: '🥶', name: 'Cold Face', tags: ['freezing', 'ice', 'winter'] },
      { char: '🥴', name: 'Woozy Face', tags: ['dizzy', 'drunk', 'tired'] },
      { char: '😵', name: 'Face with Crossed-Out Eyes', tags: ['dizzy', 'knocked out'] },
      { char: '🤯', name: 'Exploding Head', tags: ['mind blown', 'shock', 'wow'] },
      { char: '🤠', name: 'Cowboy Hat Face', tags: ['cowboy', 'country', 'sheriff'] },
      { char: '🥳', name: 'Partying Face', tags: ['celebrate', 'birthday', 'party', 'cheers'] },
      { char: '😎', name: 'Smiling Face with Sunglasses', tags: ['cool', 'boss', 'summer'] },
      { char: '🤓', name: 'Nerd Face', tags: ['geek', 'glasses', 'study', 'smart'] },
      { char: '🧐', name: 'Face with Monocle', tags: ['curious', 'examine', 'inspect'] },
      { char: '😕', name: 'Confused Face', tags: ['confused', 'puzzled'] },
      { char: '😟', name: 'Worried Face', tags: ['nervous', 'anxious'] },
      { char: '🙁', name: 'Slightly Frowning Face', tags: ['sad', 'unhappy'] },
      { char: '😮', name: 'Face with Open Mouth', tags: ['surprise', 'wow', 'gasp'] },
      { char: '😯', name: 'Hushed Face', tags: ['surprise', 'quiet'] },
      { char: '😲', name: 'Astonished Face', tags: ['shocked', 'speechless'] },
      { char: '😳', name: 'Flushed Face', tags: ['embarrassed', 'blush', 'shock'] },
      { char: '🥺', name: 'Pleading Face', tags: ['begging', 'cute', 'please', 'puppy eyes'] },
      { char: '😦', name: 'Frowning Face with Open Mouth', tags: ['scared', 'gasp'] },
      { char: '😧', name: 'Anguished Face', tags: ['stunned', 'shocked'] },
      { char: '😨', name: 'Fearful Face', tags: ['scared', 'fear', 'terrified'] },
      { char: '😰', name: 'Anxious Face with Sweat', tags: ['nervous', 'sweat', 'worry'] },
      { char: '😥', name: 'Sad but Relieved Face', tags: ['phew', 'relief', 'almost'] },
      { char: '😢', name: 'Crying Face', tags: ['tear', 'sad', 'heartbroken'] },
      { char: '😭', name: 'Loudly Crying Face', tags: ['sob', 'cry', 'sad', 'bawling'] },
      { char: '😱', name: 'Face Screaming in Fear', tags: ['horror', 'munch', 'scream'] },
      { char: '😖', name: 'Confounded Face', tags: ['frustrated', 'struggling'] },
      { char: '😣', name: 'Persevering Face', tags: ['trying', 'pain', 'endure'] },
      { char: '😞', name: 'Disappointed Face', tags: ['sad', 'down', 'depressed'] },
      { char: '😓', name: 'Downcast Face with Sweat', tags: ['stress', 'exhausted'] },
      { char: '😩', name: 'Weary Face', tags: ['tired', 'frustrated'] },
      { char: '😫', name: 'Tired Face', tags: ['exhausted', 'done'] },
      { char: '🥱', name: 'Yawning Face', tags: ['yawn', 'sleepy', 'bored'] },
      { char: '😤', name: 'Face with Steam From Nose', tags: ['triumph', 'proud', 'furious'] },
      { char: '😡', name: 'Enraged Face', tags: ['angry', 'mad', 'rage'] },
      { char: '😠', name: 'Angry Face', tags: ['mad', 'grumpy'] },
      { char: '🤬', name: 'Face with Symbols on Mouth', tags: ['curse', 'swearing', 'angry'] },
      { char: '💀', name: 'Skull', tags: ['dead', 'dying of laughter', 'skeleton'] },
      { char: '☠️', name: 'Skull and Crossbones', tags: ['danger', 'poison', 'toxic'] },
      { char: '💩', name: 'Pile of Poo', tags: ['poop', 'funny', 'crap'] },
      { char: '🤡', name: 'Clown Face', tags: ['circus', 'fool', 'joke'] },
      { char: '👻', name: 'Ghost', tags: ['halloween', 'spooky', 'boo'] },
      { char: '👽', name: 'Alien', tags: ['ufo', 'extraterrestrial', 'sci-fi'] },
      { char: '🤖', name: 'Robot', tags: ['bot', 'ai', 'automation'] },
      { char: '🎃', name: 'Jack-o-Lantern', tags: ['halloween', 'pumpkin'] }
    ]
  },
  {
    id: 'people',
    name: 'People & Gestures',
    icon: ThumbsUp,
    emojis: [
      { char: '👍', name: 'Thumbs Up', tags: ['like', 'yes', 'agree', 'approve', 'ok'] },
      { char: '👎', name: 'Thumbs Down', tags: ['dislike', 'no', 'disagree'] },
      { char: '👊', name: 'Oncoming Fist', tags: ['punch', 'fist bump'] },
      { char: '✊', name: 'Raised Fist', tags: ['power', 'solidarity'] },
      { char: '🤛', name: 'Left-Facing Fist', tags: ['fist bump'] },
      { char: '🤜', name: 'Right-Facing Fist', tags: ['fist bump'] },
      { char: '👏', name: 'Clapping Hands', tags: ['applause', 'bravo', 'congrats'] },
      { char: '🙌', name: 'Raising Hands', tags: ['celebrate', 'praise', 'hooray'] },
      { char: '👐', name: 'Open Hands', tags: ['open', 'hug'] },
      { char: '🤲', name: 'Palms Up Together', tags: ['prayer', 'dua', 'request'] },
      { char: '🤝', name: 'Handshake', tags: ['deal', 'agreement', 'partner', 'welcome'] },
      { char: '🙏', name: 'Folded Hands', tags: ['please', 'thank you', 'namaste', 'prayer', 'hope'] },
      { char: '✍️', name: 'Writing Hand', tags: ['write', 'note', 'document'] },
      { char: '💅', name: 'Nail Polish', tags: ['carefree', 'beauty', 'slay'] },
      { char: '🤳', name: 'Selfie', tags: ['camera', 'photo'] },
      { char: '💪', name: 'Flexed Biceps', tags: ['strong', 'muscle', 'power', 'gym'] },
      { char: '🦾', name: 'Mechanical Arm', tags: ['prosthetic', 'bionic', 'tech'] },
      { char: '🦵', name: 'Leg', tags: ['kick', 'limb'] },
      { char: '🦶', name: 'Foot', tags: ['step', 'walk'] },
      { char: '👂', name: 'Ear', tags: ['listen', 'hear'] },
      { char: '👃', name: 'Nose', tags: ['smell', 'scent'] },
      { char: '🧠', name: 'Brain', tags: ['smart', 'mind', 'intellect'] },
      { char: '🫀', name: 'Anatomical Heart', tags: ['cardiology', 'pulse'] },
      { char: '🫁', name: 'Lungs', tags: ['breath', 'air'] },
      { char: '🦷', name: 'Tooth', tags: ['dentist', 'smile'] },
      { char: '🦴', name: 'Bone', tags: ['skeleton'] },
      { char: '👀', name: 'Eyes', tags: ['look', 'see', 'watch', 'curious'] },
      { char: '👁️', name: 'Eye', tags: ['vision', 'inspect'] },
      { char: '👅', name: 'Tongue', tags: ['taste'] },
      { char: '👄', name: 'Mouth', tags: ['lips', 'talk'] },
      { char: '👋', name: 'Waving Hand', tags: ['hello', 'bye', 'wave', 'hi'] },
      { char: '🤚', name: 'Raised Back of Hand', tags: ['stop', 'high five'] },
      { char: '🖐️', name: 'Hand with Fingers Splayed', tags: ['five', 'hand'] },
      { char: '✋', name: 'Raised Hand', tags: ['stop', 'high five', 'pause'] },
      { char: '🖖', name: 'Vulcan Salute', tags: ['spock', 'peace', 'star trek'] },
      { char: '👌', name: 'OK Hand', tags: ['perfect', 'good', 'fine'] },
      { char: '🤌', name: 'Pinched Fingers', tags: ['italian', 'chef kiss', 'what'] },
      { char: '🤏', name: 'Pinching Hand', tags: ['little', 'tiny', 'small'] },
      { char: '✌️', name: 'Victory Hand', tags: ['peace', 'two', 'v'] },
      { char: '🤞', name: 'Crossed Fingers', tags: ['luck', 'hope', 'promise'] },
      { char: '🤟', name: 'Love-You Gesture', tags: ['love', 'ily'] },
      { char: '🤘', name: 'Sign of the Horns', tags: ['rock on', 'metal'] },
      { char: '🤙', name: 'Call Me Hand', tags: ['call', 'shaka', 'cool'] },
      { char: '👈', name: 'Backhand Index Pointing Left', tags: ['point', 'left', 'direction'] },
      { char: '👉', name: 'Backhand Index Pointing Right', tags: ['point', 'right', 'here'] },
      { char: '👆', name: 'Backhand Index Pointing Up', tags: ['point', 'up', 'above'] },
      { char: '🖕', name: 'Middle Finger', tags: ['rude'] },
      { char: '👇', name: 'Backhand Index Pointing Down', tags: ['point', 'down', 'below'] },
      { char: '☝️', name: 'Index Pointing Up', tags: ['one', 'important', 'listen'] },
      { char: '🙋‍♂️', name: 'Man Raising Hand', tags: ['question', 'volunteer', 'present'] },
      { char: '🙋‍♀️', name: 'Woman Raising Hand', tags: ['question', 'volunteer'] },
      { char: '🙇‍♂️', name: 'Man Bowing', tags: ['apology', 'sorry', 'respect'] },
      { char: '🤷‍♂️', name: 'Man Shrugging', tags: ['shrug', 'idk', 'who knows'] },
      { char: '🤷‍♀️', name: 'Woman Shrugging', tags: ['shrug', 'idk'] },
      { char: '🤦‍♂️', name: 'Man Facepalming', tags: ['facepalm', 'disbelief', 'smh'] },
      { char: '🤦‍♀️', name: 'Woman Facepalming', tags: ['facepalm', 'smh'] },
      { char: '🧑‍💻', name: 'Technologist / Developer', tags: ['coder', 'developer', 'programmer', 'laptop'] },
      { char: '👨‍💼', name: 'Office Worker / Manager', tags: ['business', 'suit', 'boss'] },
      { char: '👩‍💼', name: 'Businesswoman', tags: ['business', 'suit', 'executive'] },
      { char: '🧑‍🔧', name: 'Mechanic / Technician', tags: ['repair', 'tool', 'service'] },
      { char: '👷‍♂️', name: 'Construction Worker', tags: ['builder', 'helmet', 'production'] },
      { char: '🕵️‍♂️', name: 'Detective', tags: ['investigate', 'spy', 'search'] },
      { char: '👮‍♂️', name: 'Police Officer', tags: ['security', 'cop', 'law'] },
      { char: '🏃‍♂️', name: 'Man Running', tags: ['fast', 'rush', 'hurry', 'sprint'] },
      { char: '🚶‍♂️', name: 'Man Walking', tags: ['walk', 'stroll'] }
    ]
  },
  {
    id: 'love',
    name: 'Hearts & Love',
    icon: Heart,
    emojis: [
      { char: '❤️', name: 'Red Heart', tags: ['love', 'like', 'heart', 'romance'] },
      { char: '🧡', name: 'Orange Heart', tags: ['warm', 'orange'] },
      { char: '💛', name: 'Yellow Heart', tags: ['friendship', 'yellow'] },
      { char: '💚', name: 'Green Heart', tags: ['nature', 'green', 'growth'] },
      { char: '💙', name: 'Blue Heart', tags: ['trust', 'blue', 'loyalty'] },
      { char: '💜', name: 'Purple Heart', tags: ['honor', 'purple', 'royal'] },
      { char: '🖤', name: 'Black Heart', tags: ['dark', 'goth', 'black'] },
      { char: '🤍', name: 'White Heart', tags: ['pure', 'white', 'peace'] },
      { char: '🤎', name: 'Brown Heart', tags: ['earth', 'brown'] },
      { char: '💔', name: 'Broken Heart', tags: ['heartbreak', 'sad', 'breakup'] },
      { char: '❤️‍🔥', name: 'Heart on Fire', tags: ['passion', 'burning love', 'intense'] },
      { char: '❤️‍🩹', name: 'Mending Heart', tags: ['healing', 'recovery'] },
      { char: '❣️', name: 'Heart Exclamation', tags: ['love', 'point'] },
      { char: '💕', name: 'Two Hearts', tags: ['love', 'sweet'] },
      { char: '💞', name: 'Revolving Hearts', tags: ['in love'] },
      { char: '💓', name: 'Beating Heart', tags: ['pulse', 'thump'] },
      { char: '💗', name: 'Growing Heart', tags: ['excited', 'warm'] },
      { char: '💖', name: 'Sparkling Heart', tags: ['sparkle', 'magic'] },
      { char: '💘', name: 'Heart with Arrow', tags: ['cupid', 'crush'] },
      { char: '💝', name: 'Heart with Ribbon', tags: ['gift', 'present', 'valentine'] },
      { char: '💟', name: 'Heart Decoration', tags: ['badge'] },
      { char: '💌', name: 'Love Letter', tags: ['mail', 'message', 'envelope'] },
      { char: '💋', name: 'Kiss Mark', tags: ['lips', 'kiss', 'flirt'] },
      { char: '🫂', name: 'People Hugging', tags: ['hug', 'comfort', 'support'] }
    ]
  },
  {
    id: 'work',
    name: 'Work, Business & ERP',
    icon: Briefcase,
    emojis: [
      { char: '💼', name: 'Briefcase', tags: ['work', 'office', 'job', 'business'] },
      { char: '📁', name: 'File Folder', tags: ['files', 'directory', 'docs'] },
      { char: '📂', name: 'Open File Folder', tags: ['folder', 'browse'] },
      { char: '📄', name: 'Page Facing Up', tags: ['document', 'page', 'pdf', 'text'] },
      { char: '📃', name: 'Page with Curl', tags: ['contract', 'report', 'sheet'] },
      { char: '📊', name: 'Bar Chart', tags: ['metrics', 'analytics', 'statistics', 'graph'] },
      { char: '📈', name: 'Chart Increasing', tags: ['growth', 'sales', 'profit', 'up'] },
      { char: '📉', name: 'Chart Decreasing', tags: ['loss', 'drop', 'down'] },
      { char: '📑', name: 'Bookmark Tabs', tags: ['tabs', 'organize', 'records'] },
      { char: '📋', name: 'Clipboard', tags: ['task', 'audit', 'checklist', 'todo'] },
      { char: '📌', name: 'Pushpin', tags: ['pin', 'notice', 'important'] },
      { char: '📍', name: 'Round Pushpin', tags: ['location', 'place', 'marker'] },
      { char: '📎', name: 'Paperclip', tags: ['attachment', 'attach', 'file'] },
      { char: '🖇️', name: 'Linked Paperclips', tags: ['linked', 'joined'] },
      { char: '📏', name: 'Straight Ruler', tags: ['measure', 'meters', 'fabric'] },
      { char: '📐', name: 'Triangular Ruler', tags: ['specs', 'blueprint', 'technical'] },
      { char: '✂️', name: 'Scissors', tags: ['cut', 'fabric', 'tailor', 'sample'] },
      { char: '📦', name: 'Package / Box', tags: ['carton', 'dispatch', 'delivery', 'inventory', 'shipment'] },
      { char: '🏷️', name: 'Label / Tag', tags: ['price', 'sku', 'barcode', 'tag'] },
      { char: '💰', name: 'Money Bag', tags: ['cash', 'finance', 'payment', 'revenue'] },
      { char: '💵', name: 'Dollar Banknote', tags: ['currency', 'money', 'billing'] },
      { char: '💳', name: 'Credit Card', tags: ['payment', 'card', 'invoice'] },
      { char: '🧾', name: 'Receipt', tags: ['bill', 'challan', 'invoice', 'expense'] },
      { char: '✉️', name: 'Envelope', tags: ['mail', 'message', 'letter'] },
      { char: '📧', name: 'E-Mail', tags: ['email', 'inbox'] },
      { char: '📥', name: 'Inbox Tray', tags: ['incoming', 'received', 'inward'] },
      { char: '📤', name: 'Outbox Tray', tags: ['outgoing', 'sent', 'outward'] },
      { char: '📞', name: 'Telephone Receiver', tags: ['call', 'phone', 'contact'] },
      { char: '📱', name: 'Mobile Phone', tags: ['cell', 'smartphone'] },
      { char: '💻', name: 'Laptop', tags: ['computer', 'pc', 'work'] },
      { char: '🖥️', name: 'Desktop Computer', tags: ['workstation', 'monitor'] },
      { char: '🖨️', name: 'Printer', tags: ['print', 'barcode', 'challan', 'label'] },
      { char: '🏭', name: 'Factory', tags: ['mill', 'manufacturing', 'plant', 'production'] },
      { char: '🏢', name: 'Office Building', tags: ['headquarters', 'company'] },
      { char: '🚚', name: 'Delivery Truck', tags: ['transport', 'dispatch', 'logistics', 'vehicle'] },
      { char: '🚛', name: 'Articulated Lorry', tags: ['freight', 'cargo', 'truck'] },
      { char: '🛒', name: 'Shopping Cart', tags: ['orders', 'purchase', 'buy'] }
    ]
  },
  {
    id: 'status',
    name: 'Status, Alerts & Badges',
    icon: AlertCircle,
    emojis: [
      { char: '✅', name: 'Check Mark Button', tags: ['done', 'ok', 'pass', 'complete', 'verified', 'yes'] },
      { char: '✔️', name: 'Check Mark', tags: ['done', 'tick', 'approved'] },
      { char: '☑️', name: 'Check Box with Check', tags: ['checked', 'task'] },
      { char: '❌', name: 'Cross Mark', tags: ['no', 'fail', 'cancel', 'rejected', 'wrong'] },
      { char: '❎', name: 'Cross Mark Button', tags: ['close', 'error'] },
      { char: '⚠️', name: 'Warning', tags: ['alert', 'caution', 'notice', 'hazard'] },
      { char: '🚨', name: 'Police Car Light / Siren', tags: ['emergency', 'urgent', 'sos', 'critical'] },
      { char: '🛑', name: 'Stop Sign', tags: ['halt', 'stop', 'block'] },
      { char: '⛔', name: 'No Entry', tags: ['forbidden', 'restricted'] },
      { char: '🚫', name: 'Prohibited', tags: ['ban', 'disabled'] },
      { char: '💯', name: 'Hundred Points', tags: ['perfect', 'score', '100', 'great'] },
      { char: '🔥', name: 'Fire', tags: ['hot', 'lit', 'urgent', 'trending', 'burn'] },
      { char: '✨', name: 'Sparkles', tags: ['clean', 'new', 'elite', 'magic', 'fresh'] },
      { char: '🌟', name: 'Glowing Star', tags: ['super', 'star', 'featured'] },
      { char: '⭐', name: 'Star', tags: ['favorite', 'rating', 'important'] },
      { char: '⚡', name: 'High Voltage', tags: ['fast', 'instant', 'quick', 'electric'] },
      { char: '💥', name: 'Collision', tags: ['boom', 'blast', 'impact'] },
      { char: '🚀', name: 'Rocket', tags: ['launch', 'deploy', 'fast', 'blastoff', 'growth'] },
      { char: '🎉', name: 'Party Popper', tags: ['celebrate', 'congrats', 'cheers', 'release'] },
      { char: '🎊', name: 'Confetti Ball', tags: ['party', 'event'] },
      { char: '🎯', name: 'Direct Hit / Bullseye', tags: ['target', 'goal', 'accurate', 'hit'] },
      { char: '💡', name: 'Light Bulb', tags: ['idea', 'tip', 'solution', 'smart'] },
      { char: '⏳', name: 'Hourglass Not Done', tags: ['pending', 'wait', 'in progress', 'time'] },
      { char: '⌛', name: 'Hourglass Done', tags: ['timeout', 'finished'] },
      { char: '⏰', name: 'Alarm Clock', tags: ['reminder', 'schedule', 'wake'] },
      { char: '⏱️', name: 'Stopwatch', tags: ['timer', 'duration', 'speed'] },
      { char: '🔔', name: 'Bell', tags: ['notification', 'alert', 'ring'] },
      { char: '🔕', name: 'Bell with Slash', tags: ['mute', 'silent'] },
      { char: '💬', name: 'Speech Balloon', tags: ['comment', 'chat', 'talk', 'message'] },
      { char: '💭', name: 'Thought Balloon', tags: ['thinking', 'idea'] },
      { char: '📢', name: 'Loudspeaker', tags: ['announcement', 'broadcast', 'public'] },
      { char: '📣', name: 'Megaphone', tags: ['cheer', 'shout', 'news'] },
      { char: '🔒', name: 'Locked', tags: ['security', 'private', 'secure'] },
      { char: '🔓', name: 'Unlocked', tags: ['open', 'public', 'access'] },
      { char: '🔑', name: 'Key', tags: ['password', 'auth', 'token'] },
      { char: '🛠️', name: 'Hammer and Wrench', tags: ['tools', 'fix', 'maintenance', 'config'] },
      { char: '⚙️', name: 'Gear', tags: ['settings', 'preferences', 'engine'] },
      { char: '🔄', name: 'Counterclockwise Arrows', tags: ['sync', 'refresh', 'repeat', 'reload'] }
    ]
  },
  {
    id: 'food',
    name: 'Food & Drinks',
    icon: Coffee,
    emojis: [
      { char: '☕', name: 'Hot Beverage / Coffee', tags: ['tea', 'chai', 'cafe', 'break'] },
      { char: '🍵', name: 'Teacup Without Handle', tags: ['green tea', 'matcha'] },
      { char: '🧃', name: 'Beverage Box', tags: ['juice'] },
      { char: '🥤', name: 'Cup with Straw', tags: ['soda', 'drink'] },
      { char: '🧋', name: 'Bubble Tea', tags: ['boba', 'tea'] },
      { char: '🍕', name: 'Pizza', tags: ['food', 'lunch', 'slice'] },
      { char: '🍔', name: 'Hamburger', tags: ['burger', 'fast food'] },
      { char: '🍟', name: 'French Fries', tags: ['fries', 'snack'] },
      { char: '🥪', name: 'Sandwich', tags: ['lunch', 'bread'] },
      { char: '🥗', name: 'Green Salad', tags: ['healthy', 'diet'] },
      { char: '🍿', name: 'Popcorn', tags: ['snack', 'movie'] },
      { char: '🍜', name: 'Steaming Bowl', tags: ['noodles', 'ramen', 'soup'] },
      { char: '🍛', name: 'Curry Rice', tags: ['curry', 'indian', 'dinner'] },
      { char: '🍚', name: 'Cooked Rice', tags: ['rice', 'grain'] },
      { char: '🍱', name: 'Bento Box', tags: ['lunch box', 'meal'] },
      { char: '🍣', name: 'Sushi', tags: ['japanese', 'fish'] },
      { char: '🍰', name: 'Shortcake', tags: ['cake', 'dessert', 'sweet'] },
      { char: '🎂', name: 'Birthday Cake', tags: ['celebrate', 'birthday'] },
      { char: '🍩', name: 'Doughnut', tags: ['donut', 'sweet'] },
      { char: '🍪', name: 'Cookie', tags: ['biscuit', 'chocolate'] },
      { char: '🍫', name: 'Chocolate Bar', tags: ['candy', 'sweet'] },
      { char: '🍬', name: 'Candy', tags: ['sweet'] },
      { char: '🍎', name: 'Red Apple', tags: ['fruit', 'healthy'] },
      { char: '🍌', name: 'Banana', tags: ['fruit'] },
      { char: '🍇', name: 'Grapes', tags: ['fruit'] },
      { char: '🍓', name: 'Strawberry', tags: ['berry', 'fruit'] },
      { char: '🥭', name: 'Mango', tags: ['aam', 'summer', 'fruit'] },
      { char: '🥥', name: 'Coconut', tags: ['nariyal'] },
      { char: '🍽️', name: 'Fork and Knife with Plate', tags: ['dinner', 'dining', 'restaurant'] }
    ]
  },
  {
    id: 'travel',
    name: 'Travel, Places & Sports',
    icon: Compass,
    emojis: [
      { char: '🚗', name: 'Automobile', tags: ['car', 'drive'] },
      { char: '🚕', name: 'Taxi', tags: ['cab', 'ride'] },
      { char: '🚙', name: 'Sport Utility Vehicle', tags: ['jeep', 'car'] },
      { char: '🚌', name: 'Bus', tags: ['transit'] },
      { char: '🏎️', name: 'Racing Car', tags: ['f1', 'speed', 'fast'] },
      { char: '🛵', name: 'Motor Scooter', tags: ['bike', 'delivery'] },
      { char: '🏍️', name: 'Motorcycle', tags: ['bike'] },
      { char: '🚲', name: 'Bicycle', tags: ['cycle'] },
      { char: '✈️', name: 'Airplane', tags: ['flight', 'travel', 'trip'] },
      { char: '🛫', name: 'Airplane Departure', tags: ['takeoff', 'leaving'] },
      { char: '🛬', name: 'Airplane Arrival', tags: ['landing', 'arrived'] },
      { char: '🚁', name: 'Helicopter', tags: ['chopper'] },
      { char: '🚂', name: 'Locomotive', tags: ['train', 'rail'] },
      { char: '🚆', name: 'Train', tags: ['metro', 'railway'] },
      { char: '🚢', name: 'Ship', tags: ['cargo', 'container', 'sea'] },
      { char: '🏝️', name: 'Desert Island', tags: ['beach', 'vacation', 'holiday'] },
      { char: '⛰️', name: 'Mountain', tags: ['peak', 'hike'] },
      { char: '🏕️', name: 'Camping', tags: ['tent', 'outdoor'] },
      { char: '🏠', name: 'House', tags: ['home'] },
      { char: '🏡', name: 'House with Garden', tags: ['residence'] },
      { char: '⚽', name: 'Soccer Ball', tags: ['football', 'sport'] },
      { char: '🏀', name: 'Basketball', tags: ['nba', 'ball'] },
      { char: '🏏', name: 'Cricket Game', tags: ['ipl', 'bat', 'ball', 'sports'] },
      { char: '🎾', name: 'Tennis', tags: ['match'] },
      { char: '🏆', name: 'Trophy', tags: ['winner', 'champion', 'first', 'cup'] },
      { char: '🥇', name: '1st Place Medal', tags: ['gold', 'winner'] },
      { char: '🥈', name: '2nd Place Medal', tags: ['silver'] },
      { char: '🥉', name: '3rd Place Medal', tags: ['bronze'] },
      { char: '🎖️', name: 'Military Medal', tags: ['honor'] },
      { char: '🇮🇳', name: 'Flag: India', tags: ['india', 'tricolor', 'bharat'] }
    ]
  }
];

const DEFAULT_RECENTS = ['👍', '❤️', '😊', '😂', '🔥', '🎉', '👏', '🙏', '✅', '💯', '🚀', '✨', '📦', '💡', '⚠️', '⏳'];

export default function EmojiPickerPopover({
  isOpen,
  onClose,
  onSelectEmoji,
  containerStyle = {}
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('recent');
  const [hoveredEmoji, setHoveredEmoji] = useState(null);
  const [recentEmojis, setRecentEmojis] = useState(() => {
    try {
      const stored = localStorage.getItem('phoenix_chat_recent_emojis');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_RECENTS;
  });

  const scrollRef = useRef(null);
  const categoryHeadersRef = useRef({});
  const searchInputRef = useRef(null);

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 50);
    } else {
      setSearchQuery('');
      setHoveredEmoji(null);
    }
  }, [isOpen]);

  // Handle emoji selection + save to recent
  const handlePickEmoji = (char, name) => {
    onSelectEmoji(char);
    setRecentEmojis((prev) => {
      const updated = [char, ...prev.filter((e) => e !== char)].slice(0, 32);
      try {
        localStorage.setItem('phoenix_chat_recent_emojis', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // Build searchable index
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    
    // Map recent emojis to emoji objects
    const recentObjs = recentEmojis.map((char) => {
      for (const cat of EMOJI_CATEGORIES) {
        const match = cat.emojis.find((e) => e.char === char);
        if (match) return match;
      }
      return { char, name: 'Emoji', tags: [] };
    });

    return EMOJI_CATEGORIES.map((cat) => {
      let emojis = cat.id === 'recent' ? recentObjs : cat.emojis;

      if (q) {
        emojis = emojis.filter(
          (e) =>
            e.char.includes(q) ||
            e.name.toLowerCase().includes(q) ||
            (e.tags && e.tags.some((t) => t.toLowerCase().includes(q)))
        );
      }

      return {
        ...cat,
        emojis
      };
    }).filter((cat) => cat.emojis.length > 0);
  }, [searchQuery, recentEmojis]);

  const scrollToCategory = (catId) => {
    setActiveCategory(catId);
    setSearchQuery('');
    const target = categoryHeadersRef.current[catId];
    if (target && scrollRef.current) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Invisible backdrop click-catcher */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99990,
          cursor: 'default'
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      />

      {/* Main Glassmorphic Emoji Container */}
      <div
        className="phoenix-emoji-popover"
        style={{
          position: 'absolute',
          bottom: 'calc(100% + 10px)',
          left: 0,
          width: '350px',
          maxWidth: 'calc(100vw - 24px)',
          height: '420px',
          maxHeight: 'min(420px, 70vh)',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 99995,
          overflow: 'hidden',
          animation: 'emojiPopoverIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          ...containerStyle
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes emojiPopoverIn {
            from {
              opacity: 0;
              transform: translateY(8px) scale(0.96);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          .phoenix-emoji-item {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            padding: 0;
            margin: 0;
            background: transparent;
            border: none;
            border-radius: 8px;
            font-size: 1.35rem;
            line-height: 1;
            cursor: pointer;
            transition: transform 0.1s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.12s ease;
            user-select: none;
            box-sizing: border-box;
          }
          .phoenix-emoji-item:hover {
            background-color: #f1f5f9;
            transform: scale(1.25);
            z-index: 5;
          }
          .phoenix-emoji-item:active {
            transform: scale(0.95);
          }
          .phoenix-emoji-cat-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border: none;
            background: transparent;
            border-radius: 8px;
            color: #64748b;
            cursor: pointer;
            transition: all 0.15s ease;
            padding: 0;
          }
          .phoenix-emoji-cat-btn:hover {
            background: #f1f5f9;
            color: #0f172a;
          }
          .phoenix-emoji-cat-btn.active {
            background: #eff6ff;
            color: #2563eb;
          }
          .phoenix-emoji-scroll-body::-webkit-scrollbar {
            width: 6px;
          }
          .phoenix-emoji-scroll-body::-webkit-scrollbar-track {
            background: transparent;
          }
          .phoenix-emoji-scroll-body::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }
          .phoenix-emoji-scroll-body::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
        `}</style>

        {/* 1. Top Search Header */}
        <div
          style={{
            padding: '10px 12px 8px 12px',
            borderBottom: '1px solid #f1f5f9',
            background: '#ffffff',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '6px 10px',
              transition: 'border-color 0.15s, box-shadow 0.15s'
            }}
          >
            <Search size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search all emojis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '0.82rem',
                color: '#0f172a',
                padding: 0,
                width: '100%'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  if (searchInputRef.current) searchInputRef.current.focus();
                }}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  color: '#94a3b8'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* 2. Category Tab Navigation Bar */}
        {!searchQuery && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 10px',
              borderBottom: '1px solid #f1f5f9',
              background: '#fafafa',
              boxSizing: 'border-box'
            }}
          >
            {EMOJI_CATEGORIES.map((cat) => {
              const IconComp = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  title={cat.name}
                  onClick={() => scrollToCategory(cat.id)}
                  className={`phoenix-emoji-cat-btn ${isActive ? 'active' : ''}`}
                >
                  <IconComp size={16} />
                </button>
              );
            })}
          </div>
        )}

        {/* 3. Scrollable Emoji Grid Body */}
        <div
          ref={scrollRef}
          className="phoenix-emoji-scroll-body"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 12px',
            boxSizing: 'border-box'
          }}
        >
          {filteredCategories.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#94a3b8',
                gap: '8px',
                padding: '24px 0'
              }}
            >
              <Smile size={32} style={{ opacity: 0.5 }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>No emojis found</div>
              <div style={{ fontSize: '0.74rem' }}>Try searching for &quot;fire&quot;, &quot;star&quot;, or &quot;done&quot;</div>
            </div>
          ) : (
            filteredCategories.map((cat) => (
              <div
                key={cat.id}
                ref={(el) => {
                  categoryHeadersRef.current[cat.id] = el;
                }}
                style={{ marginBottom: '14px' }}
              >
                {/* Category Section Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: '#64748b',
                    padding: '4px 2px 6px 2px',
                    position: 'sticky',
                    top: 0,
                    background: '#ffffff',
                    zIndex: 2
                  }}
                >
                  <span>{cat.name}</span>
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                    {cat.emojis.length}
                  </span>
                </div>

                {/* 8-Column Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(8, 1fr)',
                    gap: '3px',
                    justifyItems: 'center'
                  }}
                >
                  {cat.emojis.map((item, idx) => (
                    <button
                      key={`${cat.id}-${item.char}-${idx}`}
                      type="button"
                      className="phoenix-emoji-item"
                      title={item.name}
                      onMouseEnter={() => setHoveredEmoji(item)}
                      onMouseLeave={() => setHoveredEmoji(null)}
                      onClick={() => handlePickEmoji(item.char, item.name)}
                    >
                      {item.char}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 4. Bottom Hover Preview Bar */}
        <div
          style={{
            height: '42px',
            borderTop: '1px solid #f1f5f9',
            background: '#f8fafc',
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxSizing: 'border-box'
          }}
        >
          {hoveredEmoji ? (
            <>
              <span style={{ fontSize: '1.45rem', lineHeight: 1 }}>{hoveredEmoji.char}</span>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {hoveredEmoji.name}
              </div>
            </>
          ) : (
            <div
              style={{
                fontSize: '0.74rem',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Sparkles size={13} style={{ color: '#3b82f6' }} />
              <span>Click any emoji to insert • Search by name</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
