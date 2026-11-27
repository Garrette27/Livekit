# Panel question number map

27 November 2026. Prior Q ids are stable historical references, not the new study order. No topic was removed. Added questions have stable ids 82 onward.

| Prior Q id | Priority number | Topic |
| --- | --- | --- |
| 1 | 71 | Why did you choose this title? |
| 2 | 97 | Is the study-book title your thesis title? |
| 3 | 2 | What did you build if LiveKit already handles video? |
| 4 | 3 | Why call it secure if you still have limitations? |
| 5 | 4 | Does AI make diagnoses or treatment decisions? |
| 6 | 72 | Does flexible access mean anyone can become a doctor? |
| 7 | 21 | Why have a waiting queue when the patient has a valid link? |
| 8 | 22 | Does every patient wait? |
| 9 | 87 | Is this first-in-first-out scheduling? |
| 10 | 88 | Does the queue perform emergency triage? |
| 11 | 89 | What does admitted mean? |
| 12 | 27 | Can the patient edit a URL or request to admit themselves? |
| 13 | 26 | Can another doctor admit my patient? |
| 14 | 52 | What happens if the patient refreshes or returns? |
| 15 | 59 | Does removing a patient always create a summary? |
| 16 | 30 | How many patients can wait? |
| 17 | 28 | Can you guarantee the eleventh patient is rejected? |
| 18 | 29 | You already used a transaction before — why was there a race, and why is it gone now? |
| 19 | 90 | What was the old overshoot, and what does the fix not cover? |
| 20 | 91 | Can one room have several invitations? |
| 21 | 32 | Is ten waiting the same as ten live video participants? |
| 22 | 63 | How quickly does admission appear? |
| 23 | 64 | Are patient and doctor updates both Firestore listeners? |
| 24 | 60 | What load do ten waiting patients create? |
| 25 | 65 | Does the shared coordinator eliminate all duplicate requests? |
| 26 | 61 | Does active-only filtering eliminate archive reads? |
| 27 | 1 | How many simultaneous consultations can the whole app handle? |
| 28 | 66 | What if Firestore or the network fails? |
| 29 | 56 | Is revocation enough to prove that every prior credential instantly stops working? |
| 30 | 92 | Why not fix everything the night before defense? |
| 31 | 93 | Which manuscript pages changed for this topic? |
| 32 | 5 | What evidence can we present today? |
| 33 | 73 | Chapter I says patients get "device, browser, and location validation". Does the app do that? |
| 34 | 74 | Appendix C shows code that reads IP geolocation, stores device fingerprints and asks the AI for "prescriptions" and a Low/Medium/High risk. Is that the system you evaluated? |
| 35 | 34 | Is the video end-to-end encrypted? |
| 36 | 95 | What stops a patient opening the patient room URL directly? |
| 37 | 7 | You use ISO/IEC 25010:2023 but your questionnaire says "Usability" and "Compatibility". Which is it? |
| 38 | 6 | Five dentists — is a weighted mean of 3.51 meaningful? |
| 39 | 75 | Four of five dentists came from other clinics. Does "for Henry Cheung Dental Clinic" still hold? |
| 40 | 57 | A doctor rejects a visitor. What stops them reopening the link and queueing again? |
| 41 | 33 | Two patients share one invitation link. Can they see each other? |
| 42 | 51 | If a guest has no account, how is their queue entry kept across a refresh? |
| 43 | 58 | What if the patient's phone dies after being admitted? |
| 44 | 35 | Can the AI summary be generated without the patient agreeing to transcription? |
| 45 | 40 | Does OpenAI keep the transcripts? |
| 46 | 41 | What happens to the data after 30 days? |
| 47 | 42 | Who can see a consultation's record? |
| 48 | 70 | How do you know your tests test the real code and not a copy? |
| 49 | 76 | Waterfall says each phase is finished before the next. You fixed code during the defense week. Is that still Waterfall? |
| 50 | 79 | If you had one more month, what would you do first? |
| 51 | 23 | Could a guest take over another patient's admission by typing their email? |
| 52 | 17 | Can anyone sign up as a doctor? |
| 53 | 85 | How does a doctor assign a patient? |
| 54 | 53 | If the patient refreshes, do they use up another invitation use? |
| 55 | 54 | The patient opened the call on a second device. Does the queue think they left? |
| 56 | 55 | The doctor clicked Admit on an old screen after the patient left and came back. What happens? |
| 57 | 62 | Why does consultation history take a while to load? |
| 58 | 86 | Why did View queue show patients for an expired invitation? |
| 59 | 69 | Why so many fixes the week of the defense — doesn't that undermine your results? |
| 60 | 94 | Which manuscript pages changed? |
| 61 | 96 | Where is doctor and patient provisioning, and what pattern is it? |
| 62 | 80 | Why didn't you add file attachments to chat? |
| 63 | 43 | Is the chat used in the AI summary? |
| 64 | 44 | The summary editor showed risk "Low" for a consultation with no evidence. Is the AI inferring risk? |
| 65 | 67 | What would most likely break during your demo, and what is your plan? |
| 66 | 68 | Is the production site running these fixes? |
| 67 | 77 | What design patterns did you use? |
| 68 | 78 | What were the architectural risks you found in your own design? |
| 69 | 81 | A patient wants to send a photo of their tooth or an X-ray. Why can't they attach it in chat? |
| 70 | 82 | Wouldn't attachments make your summaries better? |
| 71 | 84 | Anyone with a link can create a patient account. Isn't that a security risk? |
| 72 | 12 | How is a doctor account created? Show us. |
| 73 | 9 | Who is the first administrator? Isn't that a chicken-and-egg problem? |
| 74 | 18 | A patient account wants to become a doctor. Can the admin convert it? |
| 75 | 45 | Did you do anything about video and audio quality? |
| 76 | 83 | Could you add attachments on Firebase's free tier? |
| 77 | 47 | How many patients used a link, and were they anonymous? |
| 78 | 31 | What happens if the doctor raises or lowers the waiting limit? |
| 79 | 8 | If you sold this to several small clinics, how would accounts be provisioned? |
| 80 | 19 | If an administrator revokes a doctor, is access cut immediately? |
| 81 | 50 | Two guests use the same clinic Wi-Fi and the same browser. Do they get mixed up? |
| 82 | 11 | Why did administrator sign-in open the doctor's Invitations page? |
| 83 | 13 | Does the new administrator signup let anyone become an administrator? |
| 84 | 14 | I clicked Grant role, but the account still opens the doctor workspace. Why? |
| 85 | 15 | Why did the configured super administrator appear as a legacy doctor? |
| 86 | 16 | What do you do when newly granted access does not appear, or the account service is down? |
| 87 | 37 | Can patients speak Filipino, Tagalog or Taglish, and what language is the summary? |
| 88 | 38 | How would you validate bilingual AI summaries rather than just demonstrate them? |
| 89 | 10 | Why must administrators use a separate doctor account? |
| 90 | 20 | Are summaries really deleted after 30 days, and which cron does that? |
| 91 | 49 | Can you reuse that scheduled worker for future attachment retention? |
| 92 | 24 | Why can one invitation have multiple history rows, and should history wait for revocation? |
| 93 | 39 | Why is transcription consent asked again when the doctor rejoins? |
| 94 | 36 | Does responsive layout mean the app is proven on every phone and iPad? |
| 95 | 48 | What belongs in the consultation room rather than repeating invitation management? |
| 96 | 46 | Does the doctor count as a verified patient visit? |
| 97 | 25 | Is appointment scheduling implemented, and why is it still deployment-gated? |
