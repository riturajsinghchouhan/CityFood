import { sendResponse } from '../../../../utils/response.js';
import * as inquiryService from '../services/partnerInquiry.service.js';

const handle = (fn) => async (req, res, next) => {
    try {
        await fn(req, res);
    } catch (error) {
        next(error);
    }
};

/** Public: the form on /franchise/landingpage, /res/landingpage and /deli/landingpage. */
export const submitInquiryController = handle(async (req, res) => {
    const inquiry = await inquiryService.submitInquiry(req.body);
    sendResponse(res, 201, 'Thank you! Our team will contact you soon.', { inquiry: { _id: inquiry._id, type: inquiry.type } });
});

export const listInquiriesController = handle(async (req, res) => {
    sendResponse(res, 200, 'Inquiries', await inquiryService.listInquiries(req.query));
});

export const updateInquiryController = handle(async (req, res) => {
    sendResponse(res, 200, 'Inquiry updated', { inquiry: await inquiryService.updateInquiry(req.params.id, req.body) });
});

export const deleteInquiryController = handle(async (req, res) => {
    sendResponse(res, 200, 'Inquiry deleted', await inquiryService.deleteInquiry(req.params.id));
});
