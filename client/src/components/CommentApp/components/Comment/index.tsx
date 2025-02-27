/* eslint-disable react/prop-types */

import React from 'react';
import ReactDOM from 'react-dom';
import FocusTrap from 'focus-trap-react';

import Icon from '../../../Icon/Icon';
import type { Store } from '../../state';
import { Author, Comment, newCommentReply } from '../../state/comments';
import {
  updateComment,
  deleteComment,
  resolveComment,
  setFocusedComment,
  addReply
} from '../../actions/comments';
import { LayoutController } from '../../utils/layout';
import { getNextReplyId } from '../../utils/sequences';
import CommentReplyComponent from '../CommentReply';
import type { TranslatableStrings } from '../../main';
import { CommentHeader }  from '../CommentHeader';
import TextArea from '../TextArea';

async function saveComment(comment: Comment, store: Store) {
  store.dispatch(
    updateComment(comment.localId, {
      mode: 'saving',
    })
  );

  try {
    store.dispatch(
      updateComment(comment.localId, {
        mode: 'default',
        text: comment.newText,
        remoteId: comment.remoteId,
        author: comment.author,
        date: comment.date,
      })
    );
  } catch (err) {
    /* eslint-disable-next-line no-console */
    console.error(err);
    store.dispatch(
      updateComment(comment.localId, {
        mode: 'save_error',
      })
    );
  }
}

async function doDeleteComment(comment: Comment, store: Store) {
  store.dispatch(
    updateComment(comment.localId, {
      mode: 'deleting',
    })
  );

  try {
    store.dispatch(deleteComment(comment.localId));
  } catch (err) {
    /* eslint-disable-next-line no-console */
    console.error(err);
    store.dispatch(
      updateComment(comment.localId, {
        mode: 'delete_error',
      })
    );
  }
}

function doResolveComment(comment: Comment, store: Store) {
  store.dispatch(
    resolveComment(comment.localId)
  );
}

export interface CommentProps {
  store: Store;
  comment: Comment;
  isFocused: boolean;
  forceFocus: boolean;
  isVisible: boolean;
  layout: LayoutController;
  user: Author | null;
  strings: TranslatableStrings;
}

export default class CommentComponent extends React.Component<CommentProps> {
  renderReplies({ hideNewReply = false } = {}): React.ReactFragment {
    const { comment, isFocused, store, user, strings } = this.props;

    if (!comment.remoteId) {
      // Hide replies UI if the comment itself isn't saved yet
      return <></>;
    }

    const onChangeNewReply = (value: string) => {
      store.dispatch(
        updateComment(comment.localId, {
          newReply: value,
        })
      );
    };

    const sendReply = async (e: React.FormEvent) => {
      e.preventDefault();

      const replyId = getNextReplyId();
      const reply = newCommentReply(replyId, user, Date.now(), {
        text: comment.newReply,
        mode: 'default',
      });
      store.dispatch(addReply(comment.localId, reply));

      store.dispatch(
        updateComment(comment.localId, {
          newReply: '',
        })
      );
    };

    const onClickCancelReply = (e: React.MouseEvent) => {
      e.preventDefault();

      store.dispatch(
        updateComment(comment.localId, {
          newReply: '',
        })
      );

      store.dispatch(setFocusedComment(null));

      // Stop the event bubbling so that the comment isn't immediately refocused
      e.stopPropagation();
    };

    const replies: React.ReactNode[] = [];
    let replyBeingEdited = false;
    for (const reply of comment.replies.values()) {
      if (reply.mode === 'saving' || reply.mode === 'editing') {
        replyBeingEdited = true;
      }

      if (!reply.deleted) {
        replies.push(
          <CommentReplyComponent
            key={reply.localId}
            store={store}
            user={user}
            comment={comment}
            reply={reply}
            strings={strings}
            isFocused={isFocused}
          />
        );
      }
    }

    // Hide new reply if a reply is being edited as well
    const newReplyHidden = hideNewReply || replyBeingEdited;

    let replyForm = <></>;
    if (!newReplyHidden && (isFocused || comment.newReply)) {
      replyForm = (
        <form onSubmit={sendReply}>
          <TextArea
            className="comment__reply-input"
            placeholder="Enter your reply..."
            value={comment.newReply}
            onChange={onChangeNewReply}
          />
          <div className="comment__reply-actions">
            <button
              disabled={comment.newReply.length === 0}
              type="submit"
              className="comment__button comment__button--primary"
            >
              {strings.REPLY}
            </button>
            <button
              type="button"
              onClick={onClickCancelReply}
              className="comment__button"
            >
              {strings.CANCEL}
            </button>
          </div>

        </form>
      );
    }

    return (
      <>
        <ul className="comment__replies">{replies}</ul>
        {replyForm}
      </>
    );
  }

  renderCreating(): React.ReactFragment {
    const { comment, store, strings, isFocused } = this.props;

    const onChangeText = (value: string) => {
      store.dispatch(
        updateComment(comment.localId, {
          newText: value,
        })
      );
    };

    const onSave = async (e: React.FormEvent) => {
      e.preventDefault();
      await saveComment(comment, store);
    };

    const onCancel = (e: React.MouseEvent) => {
      e.preventDefault();

      store.dispatch(deleteComment(comment.localId));
    };

    const descriptionId = `comment-description-${comment.localId}`;

    return (
      <>
        <CommentHeader
          descriptionId={descriptionId}
          commentReply={comment}
          store={store}
          strings={strings}
          focused={isFocused}
        />
        <form onSubmit={onSave}>
          <TextArea
            focusTarget={isFocused}
            className="comment__input"
            value={comment.newText}
            onChange={onChangeText}
            placeholder="Enter your comments..."
            additionalAttributes={{
              'aria-describedby': descriptionId
            }}
          />
          <div className="comment__actions">
            <button
              disabled={comment.newText.length === 0}
              type="submit"
              className="comment__button comment__button--primary"
            >
              {strings.COMMENT}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="comment__button"
            >
              {strings.CANCEL}
            </button>
          </div>
        </form>
      </>
    );
  }

  renderEditing(): React.ReactFragment {
    const { comment, store, strings, isFocused } = this.props;

    const onChangeText = (value: string) => {
      store.dispatch(
        updateComment(comment.localId, {
          newText: value,
        })
      );
    };

    const onSave = async (e: React.FormEvent) => {
      e.preventDefault();

      await saveComment(comment, store);
    };

    const onCancel = (e: React.MouseEvent) => {
      e.preventDefault();

      store.dispatch(
        updateComment(comment.localId, {
          mode: 'default',
          newText: comment.text,
        })
      );
    };

    const descriptionId = `comment-description-${comment.localId}`;

    return (
      <>
        <CommentHeader
          descriptionId={descriptionId}
          commentReply={comment}
          store={store}
          strings={strings}
          focused={isFocused}
        />
        <form onSubmit={onSave}>
          <TextArea
            focusTarget={isFocused}
            className="comment__input"
            value={comment.newText}
            additionalAttributes={{
              'aria-describedby': descriptionId
            }}
            onChange={onChangeText}
          />
          <div className="comment__actions">
            <button
              disabled={comment.newText.length === 0}
              type="submit"
              className="comment__button comment__button--primary"
            >
              {strings.SAVE}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="comment__button"
            >
              {strings.CANCEL}
            </button>
          </div>
        </form>
        {this.renderReplies({ hideNewReply: true })}
      </>
    );
  }

  renderSaving(): React.ReactFragment {
    const { comment, store, strings, isFocused } = this.props;

    return (
      <>
        <CommentHeader
          commentReply={comment}
          store={store}
          strings={strings}
          focused={isFocused}
        />
        <p className="comment__text">{comment.text}</p>
        <div className="comment__progress">{strings.SAVING}</div>
        {this.renderReplies({ hideNewReply: true })}
      </>
    );
  }

  renderSaveError(): React.ReactFragment {
    const { comment, store, strings, isFocused } = this.props;

    const onClickRetry = async (e: React.MouseEvent) => {
      e.preventDefault();

      await saveComment(comment, store);
    };

    return (
      <>
        <CommentHeader commentReply={comment} store={store} strings={strings} focused={isFocused} />
        <p className="comment__text">{comment.text}</p>
        {this.renderReplies({ hideNewReply: true })}
        <div className="comment__error">
          {strings.SAVE_ERROR}
          <button
            type="button"
            className="comment__button"
            onClick={onClickRetry}
          >
            {strings.RETRY}
          </button>
        </div>
      </>
    );
  }

  renderDeleteConfirm(): React.ReactFragment {
    const { comment, store, strings, isFocused } = this.props;

    const onClickDelete = async (e: React.MouseEvent) => {
      e.preventDefault();

      await doDeleteComment(comment, store);
    };

    const onClickCancel = (e: React.MouseEvent) => {
      e.preventDefault();

      store.dispatch(
        updateComment(comment.localId, {
          mode: 'default',
        })
      );
    };

    return (
      <>
        <CommentHeader commentReply={comment} store={store} strings={strings} focused={isFocused} />
        <p className="comment__text">{comment.text}</p>
        <div className="comment__confirm-delete">
          {strings.CONFIRM_DELETE_COMMENT}
          <button
            type="button"
            className="comment__button comment__button--red"
            onClick={onClickDelete}
          >
            {strings.DELETE}
          </button>
          <button
            type="button"
            className="comment__button"
            onClick={onClickCancel}
          >
            {strings.CANCEL}
          </button>
        </div>
        {this.renderReplies({ hideNewReply: true })}
      </>
    );
  }

  renderDeleting(): React.ReactFragment {
    const { comment, store, strings, isFocused } = this.props;

    return (
      <>
        <CommentHeader commentReply={comment} store={store} strings={strings} focused={isFocused} />
        <p className="comment__text">{comment.text}</p>
        <div className="comment__progress">{strings.DELETING}</div>
        {this.renderReplies({ hideNewReply: true })}
      </>
    );
  }

  renderDeleteError(): React.ReactFragment {
    const { comment, store, strings, isFocused } = this.props;

    const onClickRetry = async (e: React.MouseEvent) => {
      e.preventDefault();

      await doDeleteComment(comment, store);
    };

    const onClickCancel = async (e: React.MouseEvent) => {
      e.preventDefault();

      store.dispatch(
        updateComment(comment.localId, {
          mode: 'default',
        })
      );
    };

    return (
      <>
        <CommentHeader commentReply={comment} store={store} strings={strings} focused={isFocused} />
        <p className="comment__text">{comment.text}</p>
        {this.renderReplies({ hideNewReply: true })}
        <div className="comment__error">
          {strings.DELETE_ERROR}
          <button
            type="button"
            className="comment__button"
            onClick={onClickCancel}
          >
            {strings.CANCEL}
          </button>
          <button
            type="button"
            className="comment__button"
            onClick={onClickRetry}
          >
            {strings.RETRY}
          </button>
        </div>
      </>
    );
  }

  renderDefault(): React.ReactFragment {
    const { comment, store, strings, isFocused } = this.props;

    // Show edit/delete buttons if this comment was authored by the current user
    let onEdit;
    let onDelete;
    if (comment.author === null || this.props.user && this.props.user.id === comment.author.id) {
      onEdit = () => {
        store.dispatch(
          updateComment(comment.localId, {
            mode: 'editing',
            newText: comment.text,
          })
        );
      };

      onDelete = () => {
        store.dispatch(
          updateComment(comment.localId, {
            mode: 'delete_confirm',
          })
        );
      };
    }

    const hasUnsavedReplies =
      Array.from(comment.replies.values())
        .filter(reply => !reply.remoteId || reply.text !== reply.originalText)
        .length > 0;

    let notice = '';
    if (!comment.remoteId) {
      // Save the page to add this comment
      notice = strings.SAVE_PAGE_TO_ADD_COMMENT;
    } else if (comment.text !== comment.originalText) {
      // Save the page to save changes to this comment
      notice = strings.SAVE_PAGE_TO_SAVE_COMMENT_CHANGES;
    } else if (hasUnsavedReplies) {
      // Save the page to save replies
      notice = strings.SAVE_PAGE_TO_SAVE_REPLY;
    }

    return (
      <>
        <CommentHeader
          commentReply={comment}
          store={store}
          strings={strings}
          onResolve={doResolveComment}
          onEdit={onEdit}
          onDelete={onDelete}
          focused={isFocused}
        />
        <p className="comment__text">{comment.text}</p>
        {this.renderReplies()}
        {notice &&
          <div className="comment__notice-placeholder">
            <div className="comment__notice" role="status">
              <Icon name="info-circle" />
              {notice}
            </div>
          </div>
        }
      </>
    );
  }

  render() {
    let inner: React.ReactFragment;

    switch (this.props.comment.mode) {
    case 'creating':
      inner = this.renderCreating();
      break;

    case 'editing':
      inner = this.renderEditing();
      break;

    case 'saving':
      inner = this.renderSaving();
      break;

    case 'save_error':
      inner = this.renderSaveError();
      break;

    case 'delete_confirm':
      inner = this.renderDeleteConfirm();
      break;

    case 'deleting':
      inner = this.renderDeleting();
      break;

    case 'delete_error':
      inner = this.renderDeleteError();
      break;

    default:
      inner = this.renderDefault();
      break;
    }

    const onClick = () => {
      this.props.store.dispatch(
        setFocusedComment(this.props.comment.localId,
          { updatePinnedComment: false, forceFocus: this.props.isFocused && this.props.forceFocus }
        )
      );
    };

    const onDoubleClick = () => {
      this.props.store.dispatch(
        setFocusedComment(this.props.comment.localId, { updatePinnedComment: true, forceFocus: true })
      );
    };

    const top = this.props.layout.getCommentPosition(
      this.props.comment.localId
    );
    const right = this.props.isFocused ? 50 : 0;
    return (
      <FocusTrap
        focusTrapOptions={{
          preventScroll: true,
          clickOutsideDeactivates: true,
          onDeactivate: () => {
            this.props.store.dispatch(
              setFocusedComment(null, { updatePinnedComment: true, forceFocus: false })
            );
          },
          initialFocus: '[data-focus-target="true"]',
        } as any} // For some reason, the types for FocusTrap props don't yet include preventScroll.
        active={this.props.isFocused && this.props.forceFocus}
      >
        <li
          tabIndex={-1}
          data-focus-target={this.props.isFocused && !['creating', 'editing'].includes(this.props.comment.mode)}
          key={this.props.comment.localId}
          className={
            `comment comment--mode-${this.props.comment.mode} ${this.props.isFocused ? 'comment--focused' : ''}`
          }
          style={{
            position: 'absolute',
            top: `${top}px`,
            right: `${right}px`,
            display: this.props.isVisible ? 'block' : 'none',
          }}
          data-comment-id={this.props.comment.localId}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
        >
          {inner}
        </li>
      </FocusTrap>
    );
  }

  componentDidMount() {
    const element = ReactDOM.findDOMNode(this);

    if (element instanceof HTMLElement) {
      this.props.layout.setCommentElement(this.props.comment.localId, element);

      if (this.props.isVisible) {
        this.props.layout.setCommentHeight(
          this.props.comment.localId,
          element.offsetHeight
        );
      }
    }
  }

  componentWillUnmount() {
    this.props.layout.setCommentElement(this.props.comment.localId, null);
  }

  componentDidUpdate() {
    const element = ReactDOM.findDOMNode(this);

    // Keep height up to date so that other comments will be moved out of the way
    if (this.props.isVisible && element instanceof HTMLElement) {
      this.props.layout.setCommentHeight(
        this.props.comment.localId,
        element.offsetHeight
      );
    }
  }
}
