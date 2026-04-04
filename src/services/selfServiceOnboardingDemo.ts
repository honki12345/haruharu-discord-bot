import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type InteractionReplyOptions,
  type ModalSubmitInteraction,
} from 'discord.js';
import { testChannelId } from '../commandChannelConfig.js';
import {
  executeApplyCamSelfService,
  executeApplyVacationSelfService,
  executeRegisterSelfService,
  executeStopWakeupSelfService,
} from './selfServiceActions.js';

const SELF_SERVICE_DEMO_PREFIX = 'self-service-demo:';
const REGISTER_OPEN_CUSTOM_ID = `${SELF_SERVICE_DEMO_PREFIX}register:open`;
const REGISTER_SUBMIT_CUSTOM_ID = `${SELF_SERVICE_DEMO_PREFIX}register:submit`;
const APPLY_VACATION_OPEN_CUSTOM_ID = `${SELF_SERVICE_DEMO_PREFIX}apply-vacation:open`;
const APPLY_VACATION_SUBMIT_CUSTOM_ID = `${SELF_SERVICE_DEMO_PREFIX}apply-vacation:submit`;
const STOP_WAKEUP_OPEN_CUSTOM_ID = `${SELF_SERVICE_DEMO_PREFIX}stop-wakeup:open`;
const STOP_WAKEUP_CONFIRM_CUSTOM_ID = `${SELF_SERVICE_DEMO_PREFIX}stop-wakeup:confirm`;
const STOP_WAKEUP_CANCEL_CUSTOM_ID = `${SELF_SERVICE_DEMO_PREFIX}stop-wakeup:cancel`;
const APPLY_CAM_CUSTOM_ID = `${SELF_SERVICE_DEMO_PREFIX}apply-cam:submit`;
const REGISTER_WAKETIME_INPUT_ID = 'waketime';
const APPLY_VACATION_DATE_INPUT_ID = 'date';

const buildRegisterModal = () =>
  new ModalBuilder()
    .setCustomId(REGISTER_SUBMIT_CUSTOM_ID)
    .setTitle('기상 등록/수정')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(REGISTER_WAKETIME_INPUT_ID)
          .setLabel('기상시간 (05:00~09:00, HHmm 또는 HH:mm)')
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

const buildInvalidDemoChannelReply = () =>
  ({
    content: '이 셀프서비스 데모는 `testChannelId` 채널에서만 사용할 수 있어요.',
    ephemeral: true,
  }) satisfies InteractionReplyOptions;

const ensureDemoChannel = async (interaction: {
  channelId: string | null;
  reply: (options: InteractionReplyOptions) => Promise<unknown>;
}) => {
  if (interaction.channelId === testChannelId) {
    return true;
  }

  await interaction.reply(buildInvalidDemoChannelReply());
  return false;
};

const buildSelfServiceDemoMessage = () => ({
  content: [
    '[self-service-demo]',
    '테스트 채널에서 버튼/모달 self-service 흐름을 샘플로 검증하는 메시지입니다.',
    '- 기상 등록/수정: modal 입력 후 기존 `/register` 서비스 로직 재사용',
    '- 휴가 신청: modal 입력 후 기존 `/apply-vacation` 서비스 로직 재사용',
    '- 기상 중단: 확인 단계 후 기존 `/stop-wakeup` 서비스 로직 재사용',
    '- 캠스터디 참여: 기존 `/apply-cam` 서비스 로직 재사용',
  ].join('\n'),
  components: [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(REGISTER_OPEN_CUSTOM_ID).setLabel('기상 등록/수정').setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(APPLY_VACATION_OPEN_CUSTOM_ID)
        .setLabel('휴가 신청')
        .setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(STOP_WAKEUP_OPEN_CUSTOM_ID).setLabel('기상 중단').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(APPLY_CAM_CUSTOM_ID).setLabel('캠스터디 참여').setStyle(ButtonStyle.Success),
    ),
  ],
});

const isSelfServiceDemoButtonCustomId = (customId: string) =>
  [
    REGISTER_OPEN_CUSTOM_ID,
    APPLY_VACATION_OPEN_CUSTOM_ID,
    STOP_WAKEUP_OPEN_CUSTOM_ID,
    STOP_WAKEUP_CONFIRM_CUSTOM_ID,
    STOP_WAKEUP_CANCEL_CUSTOM_ID,
    APPLY_CAM_CUSTOM_ID,
  ].includes(customId);

const isSelfServiceDemoModalCustomId = (customId: string) =>
  [REGISTER_SUBMIT_CUSTOM_ID, APPLY_VACATION_SUBMIT_CUSTOM_ID].includes(customId);

const handleSelfServiceDemoButtonInteraction = async (interaction: ButtonInteraction) => {
  if (!(await ensureDemoChannel(interaction))) {
    return;
  }

  switch (interaction.customId) {
    case REGISTER_OPEN_CUSTOM_ID:
      await interaction.showModal(buildRegisterModal());
      return;
    case APPLY_VACATION_OPEN_CUSTOM_ID:
      await interaction.showModal(buildApplyVacationModal());
      return;
    case STOP_WAKEUP_OPEN_CUSTOM_ID:
      await interaction.reply(buildStopWakeupConfirmReply());
      return;
    case STOP_WAKEUP_CONFIRM_CUSTOM_ID:
      await executeStopWakeupSelfService({
        interaction,
        commandName: 'stop-wakeup',
      });
      return;
    case STOP_WAKEUP_CANCEL_CUSTOM_ID:
      await interaction.reply({
        content: '기상스터디 중단을 취소했습니다.',
        ephemeral: true,
      });
      return;
    case APPLY_CAM_CUSTOM_ID:
      await executeApplyCamSelfService({
        interaction,
        commandName: 'apply-cam',
      });
      return;
    default:
      return;
  }
};

const handleSelfServiceDemoModalSubmitInteraction = async (interaction: ModalSubmitInteraction) => {
  if (!(await ensureDemoChannel(interaction))) {
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

export {
  buildSelfServiceDemoMessage,
  handleSelfServiceDemoButtonInteraction,
  handleSelfServiceDemoModalSubmitInteraction,
  isSelfServiceDemoButtonCustomId,
  isSelfServiceDemoModalCustomId,
};
