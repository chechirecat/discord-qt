import {
  BrushStyle,
  QBrush,
  QColor,
  QListWidget,
  QListWidgetItem,
  QPoint,
  QSize,
  ScrollBarPolicy,
  Shape,
  WidgetEventTypes,
} from '@nodegui/nodegui';
import { GuildChannel, NewsChannel, TextChannel } from 'discord.js';
import { app, MAX_QSIZE } from '../..';
import { createLogger } from '../../utilities/Console';
import { Events } from '../../utilities/Events';
import { ViewOptions } from '../../views/ViewOptions';
import { UserButton } from '../UserButton/UserButton';

const { debug } = createLogger('MembersList');

export class MembersList extends QListWidget {
  private channel?: TextChannel | NewsChannel;

  private configHidden = false;

  private viewHidden = false;

  private isLoading = false;

  private prevUpdate = new Date().getTime();

  private p0 = new QPoint(0, 0);

  private get isShown() {
    return !this.configHidden && !this.viewHidden;
  }

  constructor() {
    super();
    this.setObjectName('MembersList');
    this.setFrameShape(Shape.NoFrame);
    this.setSelectionRectVisible(false);
    this.setHorizontalScrollBarPolicy(ScrollBarPolicy.ScrollBarAlwaysOff);
    this.setMinimumSize(240, 0);
    this.setMaximumSize(240, MAX_QSIZE);
    this.addEventListener(WidgetEventTypes.Paint, this.loadAvatars.bind(this));

    app.on(Events.SWITCH_VIEW, (view: string, options?: ViewOptions) => {
      if (view === 'dm' || (view === 'guild' && !options?.channel)) {
        this.viewHidden = true;
      } else if (view === 'guild' && options?.channel) {
        if (this.isShown && options.channel !== this.channel) {
          this.loadList(options.channel);
        }

        this.channel = options.channel as TextChannel;
        this.viewHidden = false;
      }

      this.updateVisibility();
    });

    app.on(Events.CONFIG_UPDATE, (config) => {
      this.configHidden = config.get('hideMembersList');
      this.updateVisibility();
    });
  }

  private updateVisibility() {
    if (this.isShown === this.isVisible()) return;

    if (this.isShown) {
      this.show();

      if (this.channel) {
        this.loadList(this.channel);
      }
    } else {
      this.hide();
    }
  }

  async loadAvatars() {
    if (this.isLoading || this.native.destroyed) {
      return;
    }

    const cDate = new Date().getTime();

    if (cDate - this.prevUpdate < 100) {
      return;
    }

    this.isLoading = true;

    const y = -this.mapToParent(this.p0).y();
    const height = this.size().height();
    const promises: Promise<void>[] = [];

    for (const btn of this.nodeChildren.values()) {
      const button = btn as UserButton;
      const iy = button.mapToParent(this.p0).y();

      if (iy >= y - 100 && iy <= y + height + 100) {
        button.load();
        promises.push(button.loadAvatar());
      }
    }

    await Promise.all(promises);

    this.isLoading = false;
  }

  /**
   * Loads all channel members.
   * TODO: load users while scrolling.
   */
  private loadList(channel: GuildChannel) {
    if (!['text', 'news'].includes(channel.type)) {
      return;
    }

    debug(`Loading members list for #${channel.name} (${channel.id})...`);

    this.hide();

    this.channel?.members.forEach((member) => {
      UserButton.deleteInstance(member);
    });

    this.channel = channel as TextChannel | NewsChannel;

    this.nodeChildren.clear();
    this.clear();

    const size = new QSize(224, 44);
    const background = new QBrush(new QColor('transparent'), BrushStyle.NoBrush);

    for (const member of channel.members.values()) {
      const btn = UserButton.createInstance(this, member);
      const item = new QListWidgetItem();

      item.setSizeHint(size);
      item.setFlags(0);
      item.setBackground(background);
      this.addItem(item);
      this.setItemWidget(item, btn);
    }

    this.show();

    debug('Finished loading members list.');
  }
}
