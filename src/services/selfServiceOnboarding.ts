import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Collection,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type InteractionReplyOptions,
  type ModalSubmitInteraction,
} from 'discord.js';
import { startHereChannelId, timeStartHereChannelId } from '../commandChannelConfig.js';
import { logger } from '../logger.js';
import {
  executeApplyCamSelfService,
  executeApplyVacationSelfService,
  executeRegisterSelfService,
  executeStopWakeupSelfService,
} from './selfServiceActions.js';

type SelfServiceOnboardingType = 'start-here' | 'time-start-here';

type ManagedSelfServiceMessage = {
  id: string;
  content: string;
  createdTimestamp: number;
  components?: Array<{
    components?: Array<{
      customId?: string;
      custom_id?: string;
    }>;
  }>;
  author?: {
    id: string;
  };
  editable?: boolean;
  edit: (payload: ReturnType<typeof buildSelfServiceOnboardingMessage>) => Promise<unknown>;
  delete: () => Promise<unknown>;
};

type ManagedSelfServiceChannel = {
  id?: string;
  type?: ChannelType;
  messages: {
    fetch: (options: {
      limit: number;
    }) => Promise<Collection<string, ManagedSelfServiceMessage> | ManagedSelfServiceMessage[]>;
  };
  send: (payload: ReturnType<typeof buildSelfServiceOnboardingMessage>) => Promise<unknown>;
};

type SelfServiceOnboardingClient = {
  channels: {
    fetch: (channelId: string) => Promise<unknown>;
  };
};

const SELF_SERVICE_ONBOARDING_PREFIX = 'self-service-onboarding:';
const REGISTER_OPEN_CUSTOM_ID = `${SELF_SERVICE_ONBOARDING_PREFIX}register:open`;
const REGISTER_SUBMIT_CUSTOM_ID = `${SELF_SERVICE_ONBOARDING_PREFIX}register:submit`;
const APPLY_VACATION_OPEN_CUSTOM_ID = `${SELF_SERVICE_ONBOARDING_PREFIX}apply-vacation:open`;
const APPLY_VACATION_SUBMIT_CUSTOM_ID = `${SELF_SERVICE_ONBOARDING_PREFIX}apply-vacation:submit`;
const STOP_WAKEUP_OPEN_CUSTOM_ID = `${SELF_SERVICE_ONBOARDING_PREFIX}stop-wakeup:open`;
const STOP_WAKEUP_CONFIRM_CUSTOM_ID = `${SELF_SERVICE_ONBOARDING_PREFIX}stop-wakeup:confirm`;
const STOP_WAKEUP_CANCEL_CUSTOM_ID = `${SELF_SERVICE_ONBOARDING_PREFIX}stop-wakeup:cancel`;
const APPLY_CAM_CUSTOM_ID = `${SELF_SERVICE_ONBOARDING_PREFIX}apply-cam:submit`;
const REGISTER_WAKETIME_INPUT_ID = 'waketime';
const APPLY_VACATION_DATE_INPUT_ID = 'date';

const buildInvalidStartHereReply = () =>
  ({
    content: '`#start-here`에서만 사용할 수 있어요. 질문은 `#qna`를 이용해 주세요.',
    ephemeral: true,
  }) satisfies InteractionReplyOptions;

const buildInvalidOperatingChannelReply = () =>
  ({
    content: '이 셀프서비스 버튼은 운영 온보딩 채널에서만 사용할 수 있어요.',
    ephemeral: true,
  }) satisfies InteractionReplyOptions;

const buildStopWakeupConfirmReply = () =>
  ({
    content: '기상스터디 참여를 중단할까요? 확인을 누르면 기존 `/stop-wakeup` 처리 로직을 그대로 실행합니다.',
    ephemeral: true,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(STOP_WAKEUP_CONFIRM_CUSTOM_ID)
          .setLabel('중단 확인')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(STOP_WAKEUP_CANCEL_CUSTOM_ID).setLabel('취소').setStyle(ButtonStyle.Secondary),
      ),
    ],
  }) satisfies InteractionReplyOptions;

const buildRegisterModal = () =>
  new ModalBuilder()
    .setCustomId(REGISTER_SUBMIT_CUSTOM_ID)
    .setTitle('기상 등록/수정')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(REGISTER_WAKETIME_INPUT_ID)
          .setLabel('기상시간 (HHmm)')
          .setPlaceholder('0700')
          .setRequired(true)
          .setStyle(TextInputStyle.Short),
      ),
    );

const buildApplyVacationModal = () =>
  new ModalBuilder()
    .setCustomId(APPLY_VACATION_SUBMIT_CUSTOM_ID)
    .setTitle('휴가 신청')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(APPLY_VACATION_DATE_INPUT_ID)
          .setLabel('휴가 날짜 (yyyymmdd)')
          .setPlaceholder('20260330')
          .setRequired(true)
          .setStyle(TextInputStyle.Short),
      ),
    );

const buildMarker = (onboardingType: SelfServiceOnboardingType) => `[self-service-onboarding:${onboardingType}]`;

const getManagedCustomIds = (onboardingType: SelfServiceOnboardingType) =>
  onboardingType === 'start-here'
    ? [APPLY_CAM_CUSTOM_ID, REGISTER_OPEN_CUSTOM_ID]
    : [REGISTER_OPEN_CUSTOM_ID, APPLY_VACATION_OPEN_CUSTOM_ID, STOP_WAKEUP_OPEN_CUSTOM_ID];

const getMessageCustomIds = (message: ManagedSelfServiceMessage) =>
  (message.components ?? [])
    .flatMap(row => row.components ?? [])
    .map(component => component.customId ?? component.custom_id)
    .filter((customId): customId is string => typeof customId === 'string')
    .sort();

const matchesManagedMessageFingerprint = (
  message: ManagedSelfServiceMessage,
  onboardingType: SelfServiceOnboardingType,
) => {
  const expectedCustomIds = [...getManagedCustomIds(onboardingType)].sort();
  const messageCustomIds = getMessageCustomIds(message);

  return (
    expectedCustomIds.length === messageCustomIds.length &&
    expectedCustomIds.every((customId, index) => customId === messageCustomIds[index])
  );
};

const buildSelfServiceOnboardingMessage = (onboardingType: SelfServiceOnboardingType) => {
  const rows =
    onboardingType === 'start-here'
      ? [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(APPLY_CAM_CUSTOM_ID)
              .setLabel('캠스터디 참여')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(REGISTER_OPEN_CUSTOM_ID)
              .setLabel('기상챌린지 참여')
              .setStyle(ButtonStyle.Primary),
          ),
        ]
      : [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(REGISTER_OPEN_CUSTOM_ID)
              .setLabel('기상 등록/수정')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(APPLY_VACATION_OPEN_CUSTOM_ID)
              .setLabel('휴가 신청')
              .setStyle(ButtonStyle.Secondary),
          ),
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(STOP_WAKEUP_OPEN_CUSTOM_ID)
              .setLabel('기상 중단')
              .setStyle(ButtonStyle.Danger),
          ),
        ];

  return {
    content: '',
    components: rows,
  };
};

const isSelfServiceOnboardingButtonCustomId = (customId: string) =>
  [
    REGISTER_OPEN_CUSTOM_ID,
    APPLY_VACATION_OPEN_CUSTOM_ID,
    STOP_WAKEUP_OPEN_CUSTOM_ID,
    STOP_WAKEUP_CONFIRM_CUSTOM_ID,
    STOP_WAKEUP_CANCEL_CUSTOM_ID,
    APPLY_CAM_CUSTOM_ID,
  ].includes(customId);

const isSelfServiceOnboardingModalCustomId = (customId: string) =>
  [REGISTER_SUBMIT_CUSTOM_ID, APPLY_VACATION_SUBMIT_CUSTOM_ID].includes(customId);

const isOperatingOnboardingChannelId = (channelId: string | null) =>
  channelId === startHereChannelId || channelId === timeStartHereChannelId;

const ensureOperatingOnboardingChannel = async (interaction: {
  channelId: string | null;
  reply: (options: InteractionReplyOptions) => Promise<unknown>;
}) => {
  if (isOperatingOnboardingChannelId(interaction.channelId)) {
    return true;
  }

  await interaction.reply(buildInvalidOperatingChannelReply());
  return false;
};

const handleSelfServiceOnboardingButtonInteraction = async (interaction: ButtonInteraction) => {
  switch (interaction.customId) {
    case REGISTER_OPEN_CUSTOM_ID:
      if (!(await ensureOperatingOnboardingChannel(interaction))) {
        return;
      }
      await interaction.showModal(buildRegisterModal());
      return;
    case APPLY_VACATION_OPEN_CUSTOM_ID:
      if (!(await ensureOperatingOnboardingChannel(interaction))) {
        return;
      }
      await interaction.showModal(buildApplyVacationModal());
      return;
    case STOP_WAKEUP_OPEN_CUSTOM_ID:
      if (!(await ensureOperatingOnboardingChannel(interaction))) {
        return;
      }
      await interaction.reply(buildStopWakeupConfirmReply());
      return;
    case STOP_WAKEUP_CONFIRM_CUSTOM_ID:
      if (!(await ensureOperatingOnboardingChannel(interaction))) {
        return;
      }
      await executeStopWakeupSelfService({
        interaction,
        commandName: 'stop-wakeup',
      });
      return;
    case STOP_WAKEUP_CANCEL_CUSTOM_ID:
      if (!(await ensureOperatingOnboardingChannel(interaction))) {
        return;
      }
      await interaction.reply({
        content: '기상스터디 중단을 취소했습니다.',
        ephemeral: true,
      });
      return;
    case APPLY_CAM_CUSTOM_ID:
      if (interaction.channelId !== startHereChannelId) {
        await interaction.reply(buildInvalidStartHereReply());
        return;
      }
      await executeApplyCamSelfService({
        interaction,
        commandName: 'apply-cam',
      });
      return;
    default:
      return;
  }
};

const handleSelfServiceOnboardingModalSubmitInteraction = async (interaction: ModalSubmitInteraction) => {
  if (!(await ensureOperatingOnboardingChannel(interaction))) {
    return;
  }

  switch (interaction.customId) {
    case REGISTER_SUBMIT_CUSTOM_ID:
      await executeRegisterSelfService({
        interaction,
        waketime: interaction.fields.getTextInputValue(REGISTER_WAKETIME_INPUT_ID),
        commandName: 'register',
      });
      return;
    case APPLY_VACATION_SUBMIT_CUSTOM_ID:
      await executeApplyVacationSelfService({
        interaction,
        yearmonthday: interaction.fields.getTextInputValue(APPLY_VACATION_DATE_INPUT_ID),
        commandName: 'apply-vacation',
      });
      return;
    default:
      return;
  }
};

const isManagedSelfServiceMessage = (message: unknown): message is ManagedSelfServiceMessage => {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  return (
    'id' in message &&
    'content' in message &&
    'createdTimestamp' in message &&
    'edit' in message &&
    'delete' in message &&
    typeof message.id === 'string' &&
    typeof message.content === 'string' &&
    typeof message.createdTimestamp === 'number' &&
    typeof message.edit === 'function' &&
    typeof message.delete === 'function'
  );
};

const isManagedSelfServiceChannel = (channel: unknown): channel is ManagedSelfServiceChannel => {
  if (typeof channel !== 'object' || channel === null) {
    return false;
  }

  return (
    'type' in channel &&
    channel.type === ChannelType.GuildText &&
    'send' in channel &&
    typeof channel.send === 'function' &&
    'messages' in channel &&
    typeof channel.messages === 'object' &&
    channel.messages !== null &&
    'fetch' in channel.messages &&
    typeof channel.messages.fetch === 'function'
  );
};

const syncSelfServiceOnboardingMessage = async ({
  channel,
  onboardingType,
  botUserId,
}: {
  channel: ManagedSelfServiceChannel;
  onboardingType: SelfServiceOnboardingType;
  botUserId?: string | null;
}) => {
  const managedMessages = await channel.messages.fetch({ limit: 50 });
  const messageValues =
    managedMessages instanceof Collection
      ? [...managedMessages.values()]
      : Array.isArray(managedMessages)
        ? managedMessages
        : [];
  const marker = buildMarker(onboardingType);
  const existingMessages = messageValues
    .filter(isManagedSelfServiceMessage)
    .filter(message => message.content.includes(marker) || matchesManagedMessageFingerprint(message, onboardingType))
    .filter(message => {
      if (!botUserId) {
        return true;
      }

      return !message.author?.id || message.author.id === botUserId;
    })
    .sort((left, right) => right.createdTimestamp - left.createdTimestamp);

  const payload = buildSelfServiceOnboardingMessage(onboardingType);
  const primaryMessage = existingMessages[0];

  if (primaryMessage) {
    await primaryMessage.edit(payload);
    for (const duplicateMessage of existingMessages.slice(1)) {
      await duplicateMessage.delete();
    }

    return {
      action: 'updated' as const,
      channelId: channel.id ?? 'unknown',
      onboardingType,
      messageId: primaryMessage.id,
    };
  }

  const sentMessage = await channel.send(payload);
  if (!isManagedSelfServiceMessage(sentMessage)) {
    logger.warn('self-service onboarding sync send result is not a managed message', {
      onboardingType,
      channelId: channel.id ?? 'unknown',
    });
  }

  return {
    action: 'created' as const,
    channelId: channel.id ?? 'unknown',
    onboardingType,
    messageId: isManagedSelfServiceMessage(sentMessage) ? sentMessage.id : 'unknown',
  };
};

const syncSelfServiceOnboardingMessages = async ({
  client,
  botUserId,
}: {
  client: SelfServiceOnboardingClient;
  botUserId?: string | null;
}) => {
  const syncTargets: Array<{ channelId: string; onboardingType: SelfServiceOnboardingType }> = [
    { channelId: startHereChannelId, onboardingType: 'start-here' },
  ];

  if (timeStartHereChannelId !== startHereChannelId) {
    syncTargets.push({ channelId: timeStartHereChannelId, onboardingType: 'time-start-here' });
  }

  const results = [];
  for (const target of syncTargets) {
    const channel = await client.channels.fetch(target.channelId);
    if (!isManagedSelfServiceChannel(channel)) {
      throw new Error(`Invalid self-service onboarding channel: ${target.channelId}`);
    }

    results.push(
      await syncSelfServiceOnboardingMessage({
        channel,
        onboardingType: target.onboardingType,
        botUserId,
      }),
    );
  }

  return results;
};

export {
  buildSelfServiceOnboardingMessage,
  handleSelfServiceOnboardingButtonInteraction,
  handleSelfServiceOnboardingModalSubmitInteraction,
  isSelfServiceOnboardingButtonCustomId,
  isSelfServiceOnboardingModalCustomId,
  syncSelfServiceOnboardingMessage,
  syncSelfServiceOnboardingMessages,
};
